// DB enum ResourceType이 이 튜플을 쓰고 drizzle-kit이 스키마와 함께 읽으므로 외부 패키지·상대 경로만 import한다

/** 보너스 자리를 줄 수 있는 리소스. DB enum ResourceType과 같은 값·순서다. */
export const BONUS_RESOURCES = ["FRIEND"] as const;

export type BonusResource = (typeof BONUS_RESOURCES)[number];

/** 초대 보상 등으로 늘어난 리소스 자리 수 */
export type ResourceBonuses = Readonly<Record<BonusResource, number>>;

export const NO_RESOURCE_BONUSES: ResourceBonuses = { FRIEND: 0 };
