import type { EmailSendBudget } from "../../../domain/policies/email/email-budget.policy.js";

/** Resend 무료 요금제 한도(하루 100통·한 달 3,000통)를 넘기지 않는 발송 예산 */
export const RESEND_FREE_PLAN_EMAIL_BUDGET: EmailSendBudget = {
  quota: { daily: 100, monthly: 3000 },
  standard: { daily: 70, monthly: 2700 },
  alertRatio: 0.8,
};
