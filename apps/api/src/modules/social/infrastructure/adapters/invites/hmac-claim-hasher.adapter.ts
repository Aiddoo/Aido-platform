import { createHmac } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import type { ClaimHasherPort } from "../../../application/ports/invites/claim-hasher.port.js";
import type { RewardClaimSource } from "../../../domain/policies/invites/invite-abuse.policy.js";

// 운영에서 켜면 환경 검증이 비밀을 요구한다. 로컬·테스트만 이 값으로 해시한다
const NON_PRODUCTION_SECRET = "aido-invite-claim-local-only";

@Injectable()
export class HmacClaimHasherAdapter implements ClaimHasherPort {
  readonly #secret: string;

  constructor(config: TypedConfigService) {
    this.#secret = config.get("INVITE_CLAIM_HASH_SECRET") ?? NON_PRODUCTION_SECRET;
  }

  hash(source: RewardClaimSource): string {
    return createHmac("sha256", this.#secret)
      .update(`${source.claimKind}:${source.value}`)
      .digest("hex");
  }
}
