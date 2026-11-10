import { StoreSubscriptionReconcileSchedulerPort } from "#api/modules/billing/subscriptions/application/ports/store-subscription-reconcile-scheduler.port";

export class RecordingStoreSubscriptionReconcileScheduler extends StoreSubscriptionReconcileSchedulerPort {
  readonly scheduledUserIds: string[] = [];

  async schedule(userId: string): Promise<void> {
    this.scheduledUserIds.push(userId);
  }
}
