import type { RewardClaimSource } from "../../domain/invite-abuse.domain-service.js";

/** 기기 ID·이메일 원문 대신 비교 가능한 64자 해시만 남긴다. */
export abstract class ClaimHasherPort {
  abstract hash(source: RewardClaimSource): string;
}
