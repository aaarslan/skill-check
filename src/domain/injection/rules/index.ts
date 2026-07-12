import type { InjectionRule } from "../types.ts";
import { dataExfiltrationRule } from "./dataExfiltration.ts";
import { encodedPayloadRule } from "./encodedPayload.ts";
import { fakeDelimiterRule } from "./fakeDelimiter.ts";
import { hiddenContentRule } from "./hiddenContent.ts";
import { impersonationRule } from "./impersonation.ts";
import { instructionOverrideRule } from "./instructionOverride.ts";
import { safetyDisableRule } from "./safetyDisable.ts";
import { scopeViolationRule } from "./scopeViolation.ts";
import { secretExfiltrationRule } from "./secretExfiltration.ts";
import { systemCommandRule } from "./systemCommand.ts";

export const allInjectionRules: readonly InjectionRule[] = [
  instructionOverrideRule,
  impersonationRule,
  secretExfiltrationRule,
  dataExfiltrationRule,
  systemCommandRule,
  safetyDisableRule,
  scopeViolationRule,
  encodedPayloadRule,
  fakeDelimiterRule,
  hiddenContentRule,
];
