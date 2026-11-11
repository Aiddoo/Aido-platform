import type { FeatureGrantId } from "../../domain/feature-grant-id.vo.js";
import type { FeatureGrant } from "../../domain/feature-grant.aggregate.js";

export abstract class FeatureGrantRepositoryPort {
  abstract nextId(): Promise<FeatureGrantId>;
  /** 같은 sourceKey가 이미 있으면 저장하지 않고 false를 반환한다. */
  abstract saveIfAbsent(grant: FeatureGrant): Promise<boolean>;
}
