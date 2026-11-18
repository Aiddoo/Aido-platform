import type { FeatureGrant } from "../../domain/feature-grant.aggregate.js";

export abstract class FeatureGrantRepositoryPort {
  abstract findBySourceKey(sourceKey: string): Promise<FeatureGrant | null>;
  /** 지급은 바뀌지 않는다. 같은 sourceKey가 이미 있으면 아무것도 쓰지 않아 겹친 동시 지급도 한 번만 남는다 */
  abstract save(grant: FeatureGrant): Promise<void>;
}
