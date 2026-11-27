import type { InquiryCategory } from "@aido/api/vocabulary";

import { OPERATOR_TIMEZONE } from "#api/shared/domain/time/operator-timezone";

import type { Inquiry } from "../../domain/inquiry.aggregate.js";
import type { InquirySubmissionReadModel } from "../read-models/inquiry-submission.read-model.js";

const CATEGORY_LABELS = {
  BUG_REPORT: "버그 신고",
  FEATURE_REQUEST: "기능 요청",
  PAYMENT: "결제·구독",
  OTHER: "기타",
} satisfies Record<InquiryCategory, string>;

function categoryLabel(category: InquiryCategory): string {
  return CATEGORY_LABELS[category];
}

// 담당자가 한국에서 읽으므로 KST로 적는다. 예: 2026-10-08 00:00 (KST)
export function formatSubmittedAtKst(instant: Temporal.Instant): string {
  const kst = instant.toZonedDateTimeISO(OPERATOR_TIMEZONE).toPlainDateTime();
  return `${kst.toString({ smallestUnit: "minute" }).replace("T", " ")} (KST)`;
}

export function toInquirySubmission(inquiry: Inquiry): InquirySubmissionReadModel {
  const { userEmail, category, content, submittedAt } = inquiry.toPrimitives();
  return {
    userEmail,
    category,
    categoryLabel: categoryLabel(category),
    content,
    submittedAt: formatSubmittedAtKst(submittedAt),
  };
}
