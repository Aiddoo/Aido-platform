import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

import { PremiumGrantId } from "./premium-grant-id.vo.js";

export interface PremiumGrantEndingNoticePrimitives {
  readonly id: string;
  readonly userId: string;
  readonly endsAt: Temporal.Instant;
}

interface PremiumGrantEndingNoticeProps {
  readonly userId: UserId;
  readonly endsAt: Temporal.Instant;
}

/**
 * 끝나기 전에 한 번 알릴 보상 기간(작업 원장 행). 스토어 구독도 다음 보상 기간도 이어지지 않는 마지막 기간만
 * 후보이고, 보냈다는 표시는 저장소의 조건부 묶음 갱신(claim)이 남긴다.
 */
export class PremiumGrantEndingNotice extends Entity<
  PremiumGrantId,
  PremiumGrantEndingNoticeProps
> {
  static reconstitute(primitives: PremiumGrantEndingNoticePrimitives): PremiumGrantEndingNotice {
    return new PremiumGrantEndingNotice(PremiumGrantId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      endsAt: primitives.endsAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get endsAt(): Temporal.Instant {
    return this.props.endsAt;
  }

  /** 보상은 받은 날 시작하므로 하루짜리 보상도 끝나기 전에 알린다. */
  isNoticeable(): boolean {
    return true;
  }

  toPrimitives(): PremiumGrantEndingNoticePrimitives {
    return { id: this.id.value, userId: this.props.userId.value, endsAt: this.props.endsAt };
  }
}
