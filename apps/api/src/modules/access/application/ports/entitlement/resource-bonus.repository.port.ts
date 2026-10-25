import type { GrantResourceBonusInput } from "./resource-bonus-granter.port.js";

export const RESOURCE_BONUS_REPOSITORY = Symbol("RESOURCE_BONUS_REPOSITORY");

export interface ResourceBonusRepositoryPort {
  /** 같은 sourceKey가 이미 있으면 저장하지 않고 false를 반환한다. */
  create(input: GrantResourceBonusInput): Promise<boolean>;
}
