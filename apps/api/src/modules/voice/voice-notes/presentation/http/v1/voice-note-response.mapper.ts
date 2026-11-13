import type { VoiceNoteDigestResponse } from "@aido/api/contracts/voice";

import { toActionPlanResponse } from "../../../../action-plans/presentation/http/v1/action-plan-response.mapper.js";
import type { DigestedVoiceNote } from "../../../application/use-cases/digest-voice-note.use-case.js";

export function toVoiceNoteDigestResponse(digested: DigestedVoiceNote): VoiceNoteDigestResponse {
  return {
    title: digested.title,
    summary: digested.summary,
    keyPoints: digested.keyPoints.map(({ text, startMs }) => ({ text, startMs })),
    plan: toActionPlanResponse(digested.plan),
    featureQuota: digested.featureQuota,
    charged: digested.charged,
  };
}
