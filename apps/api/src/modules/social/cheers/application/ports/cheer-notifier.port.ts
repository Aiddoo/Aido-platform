import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CheerId } from "../../domain/cheer-id.vo.js";

export interface CheerSentNotification {
  readonly cheerId: CheerId;
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly senderName: string;
  readonly message?: string;
}

// 응원 알림은 커밋 뒤 작업 큐에 넣고 기다리지 않는다
export abstract class CheerNotifierPort {
  abstract notifyCheerSent(notification: CheerSentNotification): Promise<void>;
}
