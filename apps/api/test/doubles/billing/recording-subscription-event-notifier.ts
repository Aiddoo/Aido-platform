import {
  type StoreSubscriptionEventFailureContext,
  SubscriptionEventNotifierPort,
} from "#api/modules/billing/subscriptions/application/ports/subscription-event-notifier.port";
import type { SubscriptionEventPayload } from "#api/modules/billing/subscriptions/application/read-models/subscription-event-payload.read-model";

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

  async recordBillingIssue(userId: string): Promise<void> {
    this.billingIssueUserIds.push(userId);
  }

  reportWebhookFailure(error: unknown, context: StoreSubscriptionEventFailureContext): void {
    this.failures.push({ error, context });
  }
}
