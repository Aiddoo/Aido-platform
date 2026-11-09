export const STORE_SUBSCRIPTION_RECONCILE_SCHEDULER = Symbol(
  "STORE_SUBSCRIPTION_RECONCILE_SCHEDULER",
);

export interface StoreSubscriptionReconcileSchedulerPort {
  /** 활성 UoW가 있으면 함께 커밋된다. 짧은 시간 안의 여러 요청은 사용자당 한 번으로 묶는다. */
  schedule(userId: string, at: Date): Promise<void>;
}
