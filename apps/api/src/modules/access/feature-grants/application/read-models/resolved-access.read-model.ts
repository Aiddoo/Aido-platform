import type { FeatureGrants } from "../../../shared/domain/access.constants.js";
import type { AccessSubject } from "../../../shared/domain/entitlement.domain-service.js";

/** 판단 시각의 권한 주체와 받은 자리 */
export interface ResolvedAccessReadModel extends AccessSubject {
  readonly grants: FeatureGrants;
}
