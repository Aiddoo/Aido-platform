import type { RewardClaimSource } from "../../../domain/policies/invites/invite-abuse.policy.js";

export const CLAIM_HASHER = Symbol("CLAIM_HASHER");

/** 기기 ID·이메일 원문 대신 비교 가능한 64자 해시만 남긴다. */
export interface ClaimHasherPort {
  hash(source: RewardClaimSource): string;
}
