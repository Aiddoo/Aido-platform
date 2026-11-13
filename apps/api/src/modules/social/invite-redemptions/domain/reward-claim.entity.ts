import { Entity } from "#api/shared/domain/model/entity";

import type { RewardClaimKind } from "./invite-redemptions.constants.js";
import { RewardClaimId } from "./reward-claim-id.vo.js";

export interface RewardClaimPrimitives {
  readonly claimHash: string;
  readonly claimKind: RewardClaimKind;
  readonly firstClaimedAt: Temporal.Instant;
}

interface RewardClaimProps {
  readonly claimKind: RewardClaimKind;
  readonly firstClaimedAt: Temporal.Instant;
}

interface CreateRewardClaimParams {
  readonly id: RewardClaimId;
  readonly claimKind: RewardClaimKind;
  readonly now: Temporal.Instant;
}

// 같은 기기·같은 신원의 보상 이력 한 건(작업 원장 행). 만든 뒤 바뀌지 않고 탈퇴해도 남아 재가입 남용을 막는다
export class RewardClaim extends Entity<RewardClaimId, RewardClaimProps> {
  static create(params: CreateRewardClaimParams): RewardClaim {
    return new RewardClaim(params.id, {
      claimKind: params.claimKind,
      firstClaimedAt: params.now,
    });
  }

  static reconstitute(primitives: RewardClaimPrimitives): RewardClaim {
    return new RewardClaim(RewardClaimId.reconstitute(primitives.claimHash), {
      claimKind: primitives.claimKind,
      firstClaimedAt: primitives.firstClaimedAt,
    });
  }

  get claimHash(): string {
    return this.id.value;
  }

  get claimKind(): RewardClaimKind {
    return this.props.claimKind;
  }

  toPrimitives(): RewardClaimPrimitives {
    return {
      claimHash: this.id.value,
      claimKind: this.props.claimKind,
      firstClaimedAt: this.props.firstClaimedAt,
    };
  }
}
