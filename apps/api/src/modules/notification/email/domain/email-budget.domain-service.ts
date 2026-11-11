import { match } from "ts-pattern";

import type { EmailKind, EmailPriority } from "./email-delivery.constants.js";

export interface EmailBudgetLimits {
  readonly daily: number;
  readonly monthly: number;
}

/** 일·월 발송 예산. 값은 공급자 요금제를 아는 어댑터 설정이 정한다. */
export interface EmailSendBudget {
  /** 공급자가 받아 주는 일·월 한도. critical 메일은 여기까지 보낸다. */
  readonly quota: EmailBudgetLimits;
  /** standard 메일이 멈추는 곳. 한도보다 낮게 두어 critical 몫의 여유분을 남긴다. */
  readonly standard: EmailBudgetLimits;
  /** 한도의 이 비율에 닿으면 운영 경보를 올린다. */
  readonly alertRatio: number;
}

export function resolveEmailPriority(kind: EmailKind): EmailPriority {
  return match(kind)
    .with("verification", "password-reset", "password-setup", () => "critical" as const)
    .with("inquiry", "user-report", () => "standard" as const)
    .exhaustive();
}

export function resolveEmailBudgetLimits(
  priority: EmailPriority,
  budget: EmailSendBudget,
): EmailBudgetLimits {
  return match(priority)
    .with("critical", () => budget.quota)
    .with("standard", () => budget.standard)
    .exhaustive();
}

export function emailBudgetAlertThresholds(budget: EmailSendBudget): EmailBudgetLimits {
  return {
    daily: Math.floor(budget.quota.daily * budget.alertRatio),
    monthly: Math.floor(budget.quota.monthly * budget.alertRatio),
  };
}
