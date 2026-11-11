import { ValueObject } from "#api/shared/domain/model/value-object";

import type { RewardClaimKind } from "./invites.constants.js";

interface RewardClaimValue {
  /** 기기 ID·이메일 원문 대신 남기는 64자 해시 */
  readonly claimHash: string;
  readonly claimKind: RewardClaimKind;
}

/** 같은 기기·같은 신원의 보상 이력 한 건. 탈퇴해도 남아 재가입 남용을 막는다. */
export class RewardClaim extends ValueObject<RewardClaimValue> {
  static create(value: RewardClaimValue): RewardClaim {
    return new RewardClaim({ claimHash: value.claimHash, claimKind: value.claimKind });
  }

  static reconstitute(value: RewardClaimValue): RewardClaim {
    return new RewardClaim({ claimHash: value.claimHash, claimKind: value.claimKind });
  }

  get claimHash(): string {
    return this.value.claimHash;
  }

  get claimKind(): RewardClaimKind {
    return this.value.claimKind;
  }
}
