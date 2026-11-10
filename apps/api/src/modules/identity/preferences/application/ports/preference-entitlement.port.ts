import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";

export type PreferenceEntitlementPort = Pick<EntitlementReaderPort, "can">;

/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const PREFERENCE_ENTITLEMENT = Symbol("PREFERENCE_ENTITLEMENT");
