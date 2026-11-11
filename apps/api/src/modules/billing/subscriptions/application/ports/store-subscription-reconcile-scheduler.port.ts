import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class StoreSubscriptionReconcileSchedulerPort {
  /** 활성 UoW가 있으면 함께 커밋된다. 짧은 시간 안의 여러 요청은 사용자당 한 번으로 묶는다. */
  abstract schedule(userId: UserId, at: Temporal.Instant): Promise<void>;
}
