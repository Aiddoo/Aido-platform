import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { BroadcastRecipient } from "../read-models/broadcast-recipient.read-model.js";

export abstract class BroadcastRecipientReaderPort {
  /** 키는 사용자 ID 문자열이다. 사용자마다 항상 언어와 시간대가 있다(저장값이 없으면 기본값). */
  abstract listRecipients(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, BroadcastRecipient>>;
}
