#!/usr/bin/env node
import { lstat, readdir, realpath, open, writeFile } from "node:fs/promises";
import { resolve, relative, basename, sep } from "node:path";
import { analyzeReview } from "../src/domain/review/analyze.ts";
import { exportReview, markdownReport } from "../src/domain/review/report.ts";
import { INPUT_LIMITS, TEXT_FILE_PATTERN } from "../src/domain/review/input.ts";
import { evaluateCalibration } from "../src/domain/calibration/evaluate.ts";

const usage = `Skillcheck — local static review (Node 22.18+)
  node scripts/skillcheck.mjs SKILL.md [--format json|md] [--output report.json]
  node scripts/skillcheck.mjs --compare original.md candidate.md [options]
  node scripts/skillcheck.mjs --folder path/to/skill [options]
  node scripts/skillcheck.mjs --calibration [--output calibration.json]
Options: --fail-on-high exits 1 if any high-suspicion finding exists.
Exit codes: 0 completed; 1 requested high-suspicion gate; 2 invalid input/read error.
No skill content is executed, imported, or sent to a service. JSON includes source text.
`;

async function readText(path, root) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`Only regular files are accepted: ${path}`);
  if (stat.size > INPUT_LIMITS.fileBytes) throw new Error(`File exceeds 256 KiB: ${path}`);
  const actual = await realpath(path);
  if (root) {
    const local = relative(root, actual);
    if (local.startsWith(`..${sep}`) || local === ".." || resolve(root, local) !== actual)
      throw new Error("A file escapes the selected folder.");
  }
  if (!TEXT_FILE_PATTERN.test(path)) throw new Error(`Unsupported text file: ${path}`);
  // A bounded read also rejects files that grow after metadata validation.
  const handle = await open(path, "r");
  try {
    const bytes = Buffer.alloc(INPUT_LIMITS.fileBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > INPUT_LIMITS.fileBytes) throw new Error(`File exceeds 256 KiB: ${path}`);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
  } finally {
    await handle.close();
  }
}

async function readFolder(folder) {
  const path = resolve(folder);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("Choose a regular folder, not a symbolic link.");
  const root = await realpath(path);
  const sources = [];
  let totalBytes = 0;
  let entriesVisited = 0;
  async function walk(directory, depth = 0) {
    if (depth > 20) throw new Error("Package folders may be at most 20 levels deep.");
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (++entriesVisited > 500) throw new Error("Package contains too many directory entries.");
      const full = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not accepted: ${entry.name}`);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else {
        if (sources.length >= INPUT_LIMITS.files) throw new Error("Package exceeds 100 files.");
        const content = await readText(full, root);
        totalBytes += Buffer.byteLength(content);
        if (totalBytes > INPUT_LIMITS.packageBytes) throw new Error("Package exceeds 2 MiB.");
        sources.push({ path: relative(root, full).split(sep).join("/"), content });
      }
    }
  }
  await walk(root);
  return sources;
}

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    process.stdout.write(usage);
    process.exit(0);
  }
  const paths = [];
  let mode = "single",
    format = "json",
    output = null,
    failOnHigh = false,
    calibration = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--compare" || arg === "--folder" || arg === "--calibration") {
      if (mode !== "single" || calibration) throw new Error("Choose only one review mode.");
      if (arg === "--calibration") calibration = true;
      else mode = arg === "--compare" ? "compare" : "package";
    } else if (arg === "--format" || arg === "--output") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (arg === "--format") format = value;
      else output = value;
    } else if (arg === "--fail-on-high") failOnHigh = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else paths.push(arg);
  }
  if (!["json", "md"].includes(format)) throw new Error("Format must be json or md.");
  if (calibration && (paths.length || format !== "json" || failOnHigh))
    throw new Error(
      "Calibration accepts JSON output only, without file inputs or a high-suspicion gate.",
    );
  if (!calibration && paths.length !== (mode === "compare" ? 2 : 1))
    throw new Error("Wrong number of input paths. Use --help.");
  let text,
    hasHigh = false;
  if (calibration) text = JSON.stringify(evaluateCalibration(), null, 2);
  else {
    const sources =
      mode === "package"
        ? await readFolder(paths[0])
        : await Promise.all(
            paths.map(async (path, index) => ({
              path:
                mode === "compare"
                  ? `${index === 0 ? "original" : "candidate"}/${basename(path)}`
                  : basename(path),
              content: await readText(resolve(path)),
            })),
          );
    const review = analyzeReview(mode, sources);
    hasHigh = review.documents.some((document) =>
      document.injection.some((finding) => finding.suspicion === "high"),
    );
    text =
      format === "md"
        ? markdownReport(review, {})
        : JSON.stringify(exportReview(review, {}), null, 2);
  }
  // Refuse overwrites, including accidentally choosing an input as output.
  if (output) await writeFile(resolve(output), `${text}\n`, { encoding: "utf8", flag: "wx" });
  else process.stdout.write(`${text}\n`);
  if (failOnHigh && hasHigh) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Skillcheck: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
