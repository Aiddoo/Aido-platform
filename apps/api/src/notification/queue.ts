/**
 * Notification 큐 공개 서브엔트리 (enqueue 전용 경량 경계).
 *
 * `@/notification` 메인 배럴은 Facade·PushDeliveryService를 재수출하고,
 * PushDeliveryService가 다시 `@/user-settings`를 임포트한다. 따라서
 * user-settings처럼 notification과 상호 의존하는 모듈이 메인 배럴을 임포트하면
 * ES 모듈 초기화 순환(배럴 재수출 TDZ)이 발생한다.
 *
 * 이 파일은 BullMQ enqueue 심(seam)만 재수출하여 그 순환을 원천 차단한다.
 * NotificationQueueModule/Service·큐 상수만 로드하며 heavy 배럴 그래프를
 * 끌어오지 않으므로, 알림 큐만 필요한 모듈(user-settings 등)은 이 경로를
 * 임포트한다 (forwardRef 불필요).
 */
export * from "./infrastructure/queue/notification-queue.constants";
export { NotificationQueueModule } from "./infrastructure/queue/notification-queue.module";
export { NotificationQueueService } from "./infrastructure/queue/notification-queue.service";
