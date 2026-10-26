import type { BonusResource } from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

export interface GrantResourceBonusInput {
  readonly userId: string;
  readonly resource: BonusResource;
  readonly quantity: number;
  /** 같은 보상을 두 번 지급하지 않게 하는 출처 키 */
  readonly sourceKey: string;
}

export type GrantResourceBonusResult =
  | { readonly status: "granted" }
  | { readonly status: "duplicate" };

export const RESOURCE_BONUS_GRANTER = Symbol("RESOURCE_BONUS_GRANTER");

/** 리소스 자리 보너스를 더한다. 호출자의 UoW에 참여하고 권한 캐시는 커밋 뒤 비운다. */
export interface ResourceBonusGranterPort {
  grant(input: GrantResourceBonusInput): Promise<GrantResourceBonusResult>;
}
