import type { PlanResultReplay } from "#api/modules/voice/plan-applications/voice-plan-applications.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { VoiceDigestReadModel } from "../read-models/voice-digest.read-model.js";

/** `model`은 다시 보낸 응답의 로그에도 남기려고 함께 보관하고, 응답에는 싣지 않는다. */
export interface VoiceDigestResult extends VoiceDigestReadModel {
  readonly model: string;
}

export abstract class VoiceDigestResultReplayPort implements PlanResultReplay<VoiceDigestResult> {
  abstract save(userId: UserId, idempotencyKey: string, result: VoiceDigestResult): Promise<void>;
  abstract find(userId: UserId, idempotencyKey: string): Promise<VoiceDigestResult | null>;
}
