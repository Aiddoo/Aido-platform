import type { UserRegisteredEventPayload } from "#api/modules/operations/admin-notices/application/read-models/user-registered.read-model";
import {
  AdminEventNotifierPort,
  type SubscriptionAlertInput,
} from "#api/modules/operations/admin-notices/operations-admin-notices.public";

// 큐에 올리지 않고 받은 관리자 알림 요청만 기록한다
export class RecordingAdminEventNotifier extends AdminEventNotifierPort {
  readonly userRegistrations: UserRegisteredEventPayload[] = [];
  readonly subscriptionEvents: SubscriptionAlertInput[] = [];

  notifyUserRegistered(payload: UserRegisteredEventPayload): void {
    this.userRegistrations.push(payload);
  }

  notifySubscriptionEvent(payload: SubscriptionAlertInput): void {
    this.subscriptionEvents.push(payload);
  }
}
