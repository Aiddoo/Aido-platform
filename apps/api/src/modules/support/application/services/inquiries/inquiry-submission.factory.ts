import type { InquiryCategory } from "@aido/api/vocabulary";

import type { InquirySubmission } from "../../read-models/inquiries/inquiry-submission.read-model.js";

const CATEGORY_LABELS: Record<InquiryCategory, string> = {
  BUG_REPORT: "버그 신고",
  FEATURE_REQUEST: "기능 요청",
  OTHER: "기타",
};

export function categoryLabel(category: InquiryCategory): string {
  return CATEGORY_LABELS[category];
}

export function formatSubmittedAtKst(date: Date): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getValue("year")}-${getValue("month")}-${getValue("day")} ${getValue("hour")}:${getValue("minute")} (KST)`;
}

export function buildInquirySubmission(
  input: { userEmail: string; category: InquiryCategory; content: string },
  submittedAt: Date,
): InquirySubmission {
  return {
    userEmail: input.userEmail,
    category: input.category,
    categoryLabel: categoryLabel(input.category),
    content: input.content,
    submittedAt: formatSubmittedAtKst(submittedAt),
  };
}
