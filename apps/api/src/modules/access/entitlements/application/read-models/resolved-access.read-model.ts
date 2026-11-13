import type { FeatureGrants } from "../../../shared/domain/access.constants.js";
import type { AccessSubject } from "../../../shared/domain/entitlement.domain-service.js";

const ACCESS_READ_CONSISTENCIES = ["cached", "latest"] as const;

/**
 * cached는 권한 캐시(TTL 안에서도 끝나는 시각은 넘기지 않는다)를 읽고, latest는 활성 UoW에서 캐시 없이 다시
 * 읽는다. 잠금을 잡은 쓰기 판단은 latest를 쓴다.
 */
export type AccessReadConsistency = (typeof ACCESS_READ_CONSISTENCIES)[number];

/** 판단 시각의 권한 주체와 받은 자리 */
export interface ResolvedAccess extends AccessSubject {
  readonly grants: FeatureGrants;
}
