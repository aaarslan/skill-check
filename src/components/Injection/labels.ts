import type { InjectionCategory } from "../../domain/injection/types.ts";

export const INJECTION_CATEGORY_LABELS: Record<InjectionCategory, string> = {
  "instruction-override": "Instruction override",
  impersonation: "Impersonation",
  "secret-exfiltration": "Secret exfiltration",
  "data-exfiltration": "Data exfiltration",
  "system-command": "System / command",
  "safety-disable": "Safety disable",
  "scope-violation": "Scope violation",
  "encoded-payload": "Encoded payload",
  "fake-delimiter": "Fake delimiter",
  "hidden-content": "Hidden content",
};
