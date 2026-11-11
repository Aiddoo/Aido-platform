import {
  type StoreSubscriptionEventFailureContext,
  SubscriptionEventNotifierPort,
} from "#api/modules/billing/subscriptions/application/ports/subscription-event-notifier.port";
import type { SubscriptionEventPayload } from "#api/modules/billing/subscriptions/application/read-models/subscription-event-payload.read-model";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class RecordingSubscriptionEventNotifier extends SubscriptionEventNotifierPort {
  readonly events: SubscriptionEventPayload[] = [];
  readonly billingIssueUserIds: string[] = [];
  readonly failures: {
    readonly error: unknown;
    readonly context: StoreSubscriptionEventFailureContext;
  }[] = [];

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    this.events.push(payload);
  }

  async recordBillingIssue(userId: UserId): Promise<void> {
    this.billingIssueUserIds.push(userId.value);
  }

  reportWebhookFailure(error: unknown, context: StoreSubscriptionEventFailureContext): void {
    this.failures.push({ error, context });
  }
}
