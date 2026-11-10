// identity·billing이 새 경로(admin-notices)로 옮길 때까지 옛 공개 경로와 옛 이름을 같은 클래스의 별칭으로 둔다
export {
  AdminEventNotifier,
  OperationsAdminNoticesModule as OperationsNotificationsModule,
  type SubscriptionAlertInput,
} from "./admin-notices/operations-admin-notices.public.js";
