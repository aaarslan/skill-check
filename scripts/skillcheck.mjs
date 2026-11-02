#!/usr/bin/env node
import { lstat, readdir, realpath, open, writeFile } from "node:fs/promises";
import { resolve, relative, basename, sep } from "node:path";
import { analyzeReview } from "../src/domain/review/analyze.ts";
import { exportReview, markdownReport, sarifReport } from "../src/domain/review/report.ts";
import { readFile } from "node:fs/promises";
import { INPUT_LIMITS, TEXT_FILE_PATTERN } from "../src/domain/review/input.ts";
import { evaluateCalibration } from "../src/domain/calibration/evaluate.ts";

const usage = `Skillcheck — local static review (Node 22.18+)
  skillcheck SKILL.md [--format json|md] [--output report.json]
  skillcheck --compare original.md candidate.md [options]
  skillcheck --folder path/to/skill [options]
  skillcheck --calibration [--output calibration.json]
  cat SKILL.md | skillcheck --stdin [--format sarif]
Options: --fail-on-high (or --fail-on high|medium) exits 1 at/above that suspicion. --stdin reviews piped text as SKILL.md. --format json|md|sarif. --config file.json may set {"failOn":"high"|"medium"}.
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
        sources.push({ path: relative(root, full).split(sep).join("/"), content, realPath: full });
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
    calibration = false,
    useStdin = false,
    failOn = null,
    configPath = null;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--compare" || arg === "--folder" || arg === "--calibration") {
      if (mode !== "single" || calibration) throw new Error("Choose only one review mode.");
      if (arg === "--calibration") calibration = true;
      else mode = arg === "--compare" ? "compare" : "package";
    } else if (arg === "--stdin") useStdin = true;
    else if (arg === "--fail-on" || arg === "--config") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (arg === "--fail-on") failOn = value;
      else configPath = value;
    } else if (arg === "--format" || arg === "--output") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (arg === "--format") format = value;
      else output = value;
    } else if (arg === "--fail-on-high") failOnHigh = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else paths.push(arg);
  }
  if (!["json", "md", "sarif"].includes(format))
    throw new Error("Format must be json, md, or sarif.");
  if (configPath) {
    const config = JSON.parse(await readFile(resolve(configPath), "utf8"));
    if (
      config &&
      typeof config === "object" &&
      "failOn" in config &&
      failOn === null &&
      !failOnHigh
    )
      failOn = config.failOn;
  }
  if (failOnHigh) failOn = "high";
  if (failOn !== null && !["high", "medium"].includes(failOn))
    throw new Error("--fail-on must be high or medium.");
  if (useStdin && (calibration || mode !== "single" || paths.length))
    throw new Error(
      "--stdin reviews one piped file only; do not combine it with paths or other modes.",
    );
  if (calibration && (paths.length || format !== "json" || failOnHigh || failOn !== null))
    throw new Error(
      "Calibration accepts JSON output only, without file inputs or a high-suspicion gate.",
    );
  if (!calibration && !useStdin && paths.length !== (mode === "compare" ? 2 : 1))
    throw new Error("Wrong number of input paths. Use --help.");
  let text,
    hasHigh = false;
  if (calibration) text = JSON.stringify(evaluateCalibration(), null, 2);
  else {
    let stdinText = null;
    if (useStdin) {
      const chunks = [];
      let stdinBytes = 0;
      for await (const chunk of process.stdin) {
        stdinBytes += chunk.length;
        if (stdinBytes > INPUT_LIMITS.fileBytes) throw new Error("Stdin exceeds 256 KiB.");
        chunks.push(chunk);
      }
      stdinText = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    }
    const loaded = useStdin
      ? [{ path: "SKILL.md", content: stdinText, realPath: null }]
      : mode === "package"
        ? await readFolder(paths[0])
        : await Promise.all(
            paths.map(async (path, index) => ({
              path:
                mode === "compare"
                  ? `${index === 0 ? "original" : "candidate"}/${basename(path)}`
                  : basename(path),
              content: await readText(resolve(path)),
              realPath: resolve(path),
            })),
          );
    const sources = loaded.map(({ path, content }) => ({ path, content }));
    const toUri = (absolute) =>
      relative(process.cwd(), absolute)
        .split(sep)
        .map((segment) =>
          segment === ".." || segment === "." ? segment : encodeURIComponent(segment),
        )
        .join("/");
    const artifactUris = Object.fromEntries(
      loaded.filter((s) => s.realPath).map((s) => [s.path, toUri(s.realPath)]),
    );
    const packageRootName =
      mode === "package" ? basename(await realpath(resolve(paths[0]))) : undefined;
    const review = analyzeReview(mode, sources, { packageRootName });
    const rank = { low: 1, medium: 2, high: 3 };
    hasHigh =
      failOn !== null &&
      review.documents.some((document) =>
        document.injection.some((finding) => rank[finding.suspicion] >= rank[failOn]),
      );
    text =
      format === "md"
        ? markdownReport(review, {})
        : format === "sarif"
          ? JSON.stringify(sarifReport(review, {}, artifactUris), null, 2)
          : JSON.stringify(exportReview(review, {}), null, 2);
  }
  // Refuse overwrites, including accidentally choosing an input as output.
  if (output) await writeFile(resolve(output), `${text}\n`, { encoding: "utf8", flag: "wx" });
  else process.stdout.write(`${text}\n`);
  if (hasHigh) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Skillcheck: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
