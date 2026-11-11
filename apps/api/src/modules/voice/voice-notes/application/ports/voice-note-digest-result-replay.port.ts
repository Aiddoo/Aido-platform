import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PlanResultReplay } from "../../../action-plans/application/ports/plan-result-replay.port.js";
import type { VoiceNoteDigestReadModel } from "../read-models/voice-note-digest.read-model.js";

/** `model`은 다시 보낸 응답의 로그에도 남기려고 함께 보관하고, 응답에는 싣지 않는다. */
export interface VoiceNoteDigestResult extends VoiceNoteDigestReadModel {
  readonly model: string;
}

export abstract class VoiceNoteDigestResultReplayPort implements PlanResultReplay<VoiceNoteDigestResult> {
  abstract save(
    userId: UserId,
    idempotencyKey: string,
    result: VoiceNoteDigestResult,
  ): Promise<void>;
  abstract find(userId: UserId, idempotencyKey: string): Promise<VoiceNoteDigestResult | null>;
}
