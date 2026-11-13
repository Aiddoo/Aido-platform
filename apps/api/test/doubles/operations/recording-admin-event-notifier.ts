import {
  AdminEventNotifierPort,
  type SubscriptionAlertInput,
  type UserRegisteredAlertInput,
} from "#api/modules/operations/admin-notices/application/ports/admin-event-notifier.port";

// 큐에 올리지 않고 받은 관리자 알림 요청만 기록한다
export class RecordingAdminEventNotifier extends AdminEventNotifierPort {
  readonly userRegistrations: UserRegisteredAlertInput[] = [];
  readonly subscriptionEvents: SubscriptionAlertInput[] = [];

  notifyUserRegistered(payload: UserRegisteredAlertInput): void {
    this.userRegistrations.push(payload);
  }

  notifySubscriptionEvent(payload: SubscriptionAlertInput): void {
    this.subscriptionEvents.push(payload);
  }
}
