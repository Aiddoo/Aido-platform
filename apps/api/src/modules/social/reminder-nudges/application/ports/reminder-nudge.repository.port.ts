import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ReminderNudgeId } from "../../domain/reminder-nudge-id.vo.js";
import type { ReminderNudge } from "../../domain/reminder-nudge.aggregate.js";

export abstract class ReminderNudgeRepositoryPort {
  abstract nextId(): Promise<ReminderNudgeId>;
  // 그 친구에게 보낸 리마인드 콕 중 생성 시각이 가장 늦은 것
  abstract findLastSentTo(senderId: UserId, receiverId: UserId): Promise<ReminderNudge | null>;
  // 리마인드 콕은 만든 뒤 바뀌지 않는다
  abstract save(reminder: ReminderNudge): Promise<void>;
}
