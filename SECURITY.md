# Security Policy

Skillcheck is a client-side tool for reviewing potentially adversarial LLM
skill files. Security is central to what it does, so security reports are taken
seriously.

## Threat model in brief

- **All input is untrusted.** Skill files are treated as adversarial text. They
  are parsed and scanned, never executed or interpreted as instructions.
- **No backend, no exfiltration path.** The app makes no network requests with
  user content. Analysis happens entirely in the browser.
- **The detector is best-effort.** It is designed to surface suspicious patterns
  for human review, not to be a complete or bypass-proof filter. Evasion of a
  specific heuristic is expected and interesting, but it is a detection-quality
  issue, not necessarily a vulnerability.

## What counts as a vulnerability

Please report privately if you find, for example:

- A way for loaded file content to trigger code execution, escape text
  handling, or cause the app to make an unexpected network request.
- A cross-site scripting vector through rendered file content or findings.
- Any path by which user content leaves the browser.

Detection gaps (a payload the scanner misses, or a benign string it flags) are
best raised as regular issues or pull requests, since improving them in the open
helps everyone.

## Reporting

- **Preferred:** open a
  [private security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
  on the repository (Security tab, "Report a vulnerability").
- **Alternative:** email the maintainer at `arslan.abdallah@gmail.com` with
  `[skillcheck-security]` in the subject.

Please include a description, reproduction steps, and, if possible, a minimal
sample file. Give a reasonable window to respond before any public disclosure.

## Supported versions

This is an actively developed application rather than a versioned library.
Fixes are applied to the default branch. There is no long-term support branch.
