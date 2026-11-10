// identity가 새 경로(admin-notices)로 옮길 때까지 옛 공개 경로와 옛 이름(AdminEventNotifier)을 둔다.
// AdminEventNotifierPort와 같은 인스턴스를 가리키는 구현 클래스 토큰이다(테스트 모킹이 구체 클래스를 요구한다).
export {
  AdminEventNotifierAdapter as AdminEventNotifier,
  OperationsAdminNoticesModule as OperationsNotificationsModule,
} from "./admin-notices/operations-admin-notices.public.js";
