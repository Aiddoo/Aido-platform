import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendWindow } from "../../../shared/domain/daily-send-window.domain-service.js";
import type { CheerId } from "../../domain/cheer-id.vo.js";
import type { Cheer } from "../../domain/cheer.aggregate.js";

export abstract class CheerRepositoryPort {
  abstract nextId(): Promise<CheerId>;
  abstract findById(cheerId: CheerId): Promise<Cheer | null>;
  // 그 친구에게 보낸 응원 중 생성 시각이 가장 늦은 것
  abstract findLastSent(senderId: UserId, receiverId: UserId): Promise<Cheer | null>;
  // startsAt 이상 endsAt 미만에 보낸 응원 수
  abstract countSentBetween(
    senderId: UserId,
    window: Pick<DailySendWindow, "startsAt" | "endsAt">,
  ): Promise<number>;
  abstract save(cheer: Cheer): Promise<void>;
  // 받은 사람의 안 읽은 응원만 읽음으로 바꾸고 바꾼 개수를 준다. 없는 id·남의 응원·이미 읽은 응원은 세지 않는다
  abstract markManyRead(params: {
    readonly receiverId: UserId;
    readonly cheerIds: readonly CheerId[];
    readonly now: Temporal.Instant;
  }): Promise<number>;
}
