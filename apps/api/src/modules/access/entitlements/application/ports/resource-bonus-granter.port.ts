import type { BonusResource } from "../../domain/entitlements.constants.js";

// 옛 Symbol 토큰. social이 클래스 토큰으로 옮길 때까지 같은 인스턴스를 가리키는 별칭으로 남긴다
export const RESOURCE_BONUS_GRANTER = Symbol("RESOURCE_BONUS_GRANTER");

const RESOURCE_BONUS_GRANT_STATUSES = ["granted", "duplicate"] as const;

export interface GrantResourceBonusInput {
  readonly userId: string;
  readonly resource: BonusResource;
  readonly quantity: number;
  /** 같은 보상을 두 번 지급하지 않게 하는 출처 키 */
  readonly sourceKey: string;
}

export interface GrantResourceBonusResult {
  readonly status: (typeof RESOURCE_BONUS_GRANT_STATUSES)[number];
}

/** 리소스 자리 보너스를 더한다. 호출자의 UoW에 참여하고 권한 캐시는 커밋 뒤 비운다. */
export abstract class ResourceBonusGranterPort {
  abstract grant(input: GrantResourceBonusInput): Promise<GrantResourceBonusResult>;
}
