import type { PlanResultReplay } from "../../../action-plans/application/ports/plan-result-replay.port.js";
import type { VoiceNoteDigestReadModel } from "../read-models/voice-note-digest.read-model.js";

/** `model`은 다시 보낸 응답의 로그에도 남기려고 함께 보관하고, 응답에는 싣지 않는다. */
export interface VoiceNoteDigestResult extends VoiceNoteDigestReadModel {
  readonly model: string;
}

export abstract class VoiceNoteDigestResultReplayPort implements PlanResultReplay<VoiceNoteDigestResult> {
  abstract save(
    userId: string,
    idempotencyKey: string,
    result: VoiceNoteDigestResult,
  ): Promise<void>;
  abstract find(userId: string, idempotencyKey: string): Promise<VoiceNoteDigestResult | null>;
}
