import type { PremiumGrantSource } from "@aido/api/vocabulary";

// 옛 Symbol 토큰. social이 클래스 토큰으로 옮길 때까지 같은 인스턴스를 가리키는 별칭으로 남긴다
export const PREMIUM_GRANTER = Symbol("PREMIUM_GRANTER");

export interface GrantPremiumInput {
  readonly userId: string;
  readonly source: PremiumGrantSource;
  /** 같은 보상을 두 번 지급하지 않게 하는 출처 키 (예: invite:{grantId}) */
  readonly sourceKey: string;
  readonly durationDays: number;
}

export type GrantPremiumResult =
  | { readonly status: "granted" }
  | { readonly status: "duplicate" }
  | { readonly status: "user-missing" };

/** 서버가 관리하는 프리미엄 보상 기간을 지급한다. 호출자의 UoW에 참여한다. */
export abstract class PremiumGranterPort {
  abstract grant(input: GrantPremiumInput): Promise<GrantPremiumResult>;
}
