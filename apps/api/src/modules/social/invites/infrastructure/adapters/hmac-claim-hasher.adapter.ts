import { createHmac } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { ClaimHasherPort } from "../../application/ports/claim-hasher.port.js";
import type { RewardClaimSource } from "../../domain/invite-abuse.domain-service.js";
import { type SocialInvitesConfig, socialInvitesConfig } from "../../social-invites.config.js";

// 개발 환경 밖에서 켜면 시작 검증이 비밀을 요구한다. 개발·테스트만 이 값으로 해시한다
const NON_PRODUCTION_SECRET = "aido-invite-claim-local-only";

@Injectable()
export class HmacClaimHasherAdapter extends ClaimHasherPort {
  readonly #secret: string;

  constructor(
    @Inject(socialInvitesConfig.KEY) config: Pick<SocialInvitesConfig, "claimHashSecret">,
  ) {
    super();
    this.#secret = config.claimHashSecret ?? NON_PRODUCTION_SECRET;
  }

  hash(source: RewardClaimSource): string {
    return createHmac("sha256", this.#secret)
      .update(`${source.claimKind}:${source.value}`)
      .digest("hex");
  }
}
