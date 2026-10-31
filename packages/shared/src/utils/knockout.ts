import { FormKnockoutRule } from '../schemas/index.js';

export interface KnockoutEvaluationResult {
  knockedOut: boolean;
  reason: string | null;
  ruleId: string | null;
  fieldId: string | null;
}

/**
 * Evaluates a set of form answers against configured knockout rules.
 * If any rule triggers, the candidate is immediately marked for auto-rejection.
 */
export function evaluateFormKnockoutRules(
  rules: FormKnockoutRule[] | null | undefined,
  answers: Record<string, any>
): KnockoutEvaluationResult {
  if (!rules || rules.length === 0) {
    return { knockedOut: false, reason: null, ruleId: null, fieldId: null };
  }

  for (const rule of rules) {
    const rawVal = answers[rule.fieldId];

    // Normalize value based on operator and type
    let triggersKnockout = false;

    switch (rule.operator) {
      case 'equals': {
        if (typeof rule.value === 'boolean') {
          const boolRaw = rawVal === true || rawVal === 'true' || rawVal === 'yes' || rawVal === 'Yes';
          triggersKnockout = boolRaw === rule.value;
        } else if (typeof rule.value === 'number') {
          triggersKnockout = Number(rawVal) === Number(rule.value);
        } else {
          triggersKnockout = String(rawVal ?? '').trim().toLowerCase() === String(rule.value).trim().toLowerCase();
        }
        break;
      }

      case 'not_equals': {
        if (typeof rule.value === 'boolean') {
          const boolRaw = rawVal === true || rawVal === 'true' || rawVal === 'yes' || rawVal === 'Yes';
          triggersKnockout = boolRaw !== rule.value;
        } else if (typeof rule.value === 'number') {
          triggersKnockout = Number(rawVal) !== Number(rule.value);
        } else {
          triggersKnockout = String(rawVal ?? '').trim().toLowerCase() !== String(rule.value).trim().toLowerCase();
        }
        break;
      }

      case 'less_than': {
        const numVal = Number(rawVal);
        const threshold = Number(rule.value);
        if (!isNaN(numVal) && !isNaN(threshold)) {
          triggersKnockout = numVal < threshold;
        }
        break;
      }

      case 'greater_than': {
        const numVal = Number(rawVal);
        const threshold = Number(rule.value);
        if (!isNaN(numVal) && !isNaN(threshold)) {
          triggersKnockout = numVal > threshold;
        }
        break;
      }

      case 'contains': {
        if (Array.isArray(rawVal)) {
          triggersKnockout = rawVal.some((item) =>
            String(item).toLowerCase().includes(String(rule.value).toLowerCase())
          );
        } else {
          triggersKnockout = String(rawVal ?? '')
            .toLowerCase()
            .includes(String(rule.value).toLowerCase());
        }
        break;
      }

      case 'excludes': {
        if (Array.isArray(rawVal)) {
          triggersKnockout = !rawVal.some((item) =>
            String(item).toLowerCase().includes(String(rule.value).toLowerCase())
          );
        } else {
          triggersKnockout = !String(rawVal ?? '')
            .toLowerCase()
            .includes(String(rule.value).toLowerCase());
        }
        break;
      }

      default:
        break;
    }

    if (triggersKnockout) {
      return {
        knockedOut: true,
        reason: rule.reason,
        ruleId: rule.id,
        fieldId: rule.fieldId
      };
    }
  }

  return { knockedOut: false, reason: null, ruleId: null, fieldId: null };
}

