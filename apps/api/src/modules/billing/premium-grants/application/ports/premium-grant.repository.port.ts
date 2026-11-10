import type {
  PremiumGrant,
  PremiumGrantCreationPlan,
} from "../../domain/premium-grant.aggregate.js";

export interface FindPremiumGrantUsersToReconcileParams {
  readonly now: Date;
  readonly afterUserId?: string;
  readonly limit: number;
}

export const PREMIUM_GRANT_REPOSITORY = Symbol("PREMIUM_GRANT_REPOSITORY");

export interface PremiumGrantRepositoryPort {
  /** 아직 끝나지 않은 BANKED·ACTIVE 기간을 한 번에 읽는다. */
  findOpenByUserId(userId: string): Promise<PremiumGrant[]>;
  /** 출처 키로 상태와 무관하게 읽는다. 없으면 null이다. */
  findBySourceKey(sourceKey: string): Promise<PremiumGrant | null>;
  /** ENDED로 정리한 기간 중 가장 늦은 끝 시각. 없으면 null이다. */
  findLastEndedAt(userId: string): Promise<Date | null>;
  /** 같은 sourceKey가 이미 있으면 저장하지 않고 false를 반환한다. */
  create(plan: PremiumGrantCreationPlan): Promise<boolean>;
  saveAll(grants: readonly PremiumGrant[]): Promise<void>;
  /**
   * 정리할 것이 있는 사용자를 userId 순으로 읽는다. 끝난 ACTIVE 기간, 스토어도 진행 중인 기간도 없는
   * BANKED 기간, 스토어가 유효한데 끝나지 않은 ACTIVE 기간(시작 전이면 다시 쌓고 진행 중이면 끊는다)이
   * 대상이다.
   */
  findUserIdsToReconcile(params: FindPremiumGrantUsersToReconcileParams): Promise<string[]>;
}
