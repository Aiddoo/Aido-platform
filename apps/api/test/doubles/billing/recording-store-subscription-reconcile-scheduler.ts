import { StoreSubscriptionReconcileSchedulerPort } from "#api/modules/billing/subscriptions/application/ports/store-subscription-reconcile-scheduler.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class RecordingStoreSubscriptionReconcileScheduler extends StoreSubscriptionReconcileSchedulerPort {
  readonly scheduledUserIds: string[] = [];

  async schedule(userId: UserId): Promise<void> {
    this.scheduledUserIds.push(userId.value);
  }
}
