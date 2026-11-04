import { match } from "ts-pattern";

import type { EmailKind, EmailPriority } from "../../types/email/email-delivery.types.js";

/**
 * Resend 무료 한도(하루 100통·한 달 3,000통)를 넘기지 않는 발송 예산.
 * standard는 한도보다 낮은 곳에서 멈춰 critical 몫의 여유분을 남긴다.
 */
export const EMAIL_SEND_BUDGET = {
  dailyLimit: 100,
  monthlyLimit: 3000,
  standardDailyLimit: 70,
  standardMonthlyLimit: 2700,
  /** 일·월 한도의 이 비율에 닿으면 운영 경보를 올린다 */
  alertRatio: 0.8,
} as const;

export interface EmailBudgetLimits {
  readonly daily: number;
  readonly monthly: number;
}

export function resolveEmailPriority(kind: EmailKind): EmailPriority {
  return match(kind)
    .with("verification", "password-reset", "password-setup", () => "critical" as const)
    .with("inquiry", "user-report", () => "standard" as const)
    .exhaustive();
}

export function resolveEmailBudgetLimits(priority: EmailPriority): EmailBudgetLimits {
  return match(priority)
    .with("critical", () => ({
      daily: EMAIL_SEND_BUDGET.dailyLimit,
      monthly: EMAIL_SEND_BUDGET.monthlyLimit,
    }))
    .with("standard", () => ({
      daily: EMAIL_SEND_BUDGET.standardDailyLimit,
      monthly: EMAIL_SEND_BUDGET.standardMonthlyLimit,
    }))
    .exhaustive();
}

export const EMAIL_BUDGET_ALERT_THRESHOLDS: EmailBudgetLimits = {
  daily: Math.floor(EMAIL_SEND_BUDGET.dailyLimit * EMAIL_SEND_BUDGET.alertRatio),
  monthly: Math.floor(EMAIL_SEND_BUDGET.monthlyLimit * EMAIL_SEND_BUDGET.alertRatio),
};
