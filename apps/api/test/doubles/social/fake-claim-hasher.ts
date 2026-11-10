import { createHash } from "node:crypto";

import { ClaimHasherPort } from "#api/modules/social/invites/application/ports/claim-hasher.port";
import type { RewardClaimSource } from "#api/modules/social/invites/domain/invite-abuse.domain-service";

// 운영 어댑터처럼 종류와 값으로 64자 해시를 만든다. 비밀 없이 같은 입력은 같은 해시다
export class FakeClaimHasher extends ClaimHasherPort {
  hash(source: RewardClaimSource): string {
    return createHash("sha256").update(`${source.claimKind}:${source.value}`).digest("hex");
  }
}
