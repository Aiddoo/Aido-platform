import type {
  PremiumGrant,
  PremiumGrantCreationPlan,
} from "../../../domain/aggregates/subscriptions/premium-grant.aggregate.js";

export interface FindPremiumGrantUsersToReconcileParams {
  readonly now: Date;
  readonly afterUserId?: string;
  readonly limit: number;
}

export interface FindPremiumGrantEndingNoticesParams {
  readonly now: Date;
  /** 이 시각 이전에 끝나는 마지막 보상 기간만 안내한다. */
  readonly endsBefore: Date;
  /** 같은 실행에서 이미 본 후보 다음부터 읽는다(endsAt, id 순 keyset). */
  readonly after?: { readonly endsAt: Date; readonly grantId: string };
  readonly limit: number;
}

export interface PremiumGrantEndingNotice {
  readonly grantId: string;
  readonly userId: string;
  readonly endsAt: Date;
}

export const PREMIUM_GRANT_REPOSITORY = Symbol("PREMIUM_GRANT_REPOSITORY");

export interface PremiumGrantRepositoryPort {
  /** 아직 끝나지 않은 BANKED·ACTIVE 기간을 한 번에 읽는다. */
  findOpenByUserId(userId: string): Promise<PremiumGrant[]>;
  /** 같은 sourceKey가 이미 있으면 저장하지 않고 false를 반환한다. */
  create(plan: PremiumGrantCreationPlan): Promise<boolean>;
  saveAll(grants: readonly PremiumGrant[]): Promise<void>;
  /**
   * 정리할 것이 있는 사용자를 userId 순으로 읽는다. 끝난 ACTIVE 기간, 스토어도 진행 중인 기간도 없는
   * BANKED 기간, 스토어가 유효한데 끝나지 않은 ACTIVE 기간(시작 전이면 다시 쌓고 진행 중이면 끊는다)이
   * 대상이다.
   */
  findUserIdsToReconcile(params: FindPremiumGrantUsersToReconcileParams): Promise<string[]>;
  /** 스토어 구독도 다음 기간도 없는 마지막 기간을 SKIP LOCKED로 잠그고 반환한다. 활성 UoW가 필요하다. */
  lockEndingNotices(
    params: FindPremiumGrantEndingNoticesParams,
  ): Promise<PremiumGrantEndingNotice[]>;
  markEndingNotified(grantIds: readonly string[], notifiedAt: Date): Promise<void>;
}
