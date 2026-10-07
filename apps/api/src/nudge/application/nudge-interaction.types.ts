import type { NudgeInteractionRecord, NudgeUserBrief } from "./ports/nudge.repository.port.js";

export type NudgeInteractionResult = NudgeInteractionRecord & { isAvailable: boolean };

export interface NudgeThanksPreviewResult {
  todoId: number;
  throughNudgeId: number | null;
  recipients: NudgeUserBrief[];
  totalRecipients?: number;
  nextCursor?: number | null;
  hasNext?: boolean;
}
