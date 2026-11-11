import type { InquiryCategory } from "@aido/api/vocabulary";

export interface InquirySubmission {
  readonly userEmail: string;
  readonly category: InquiryCategory;
  readonly categoryLabel: string;
  readonly content: string;
  readonly submittedAt: string;
}
