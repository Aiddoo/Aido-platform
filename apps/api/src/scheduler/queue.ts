/**
 * Scheduler 큐 공개 서브엔트리 (enqueue 전용 경량 경계).
 *
 * `@/scheduler` 메인 배럴은 SchedulerModule·오케스트레이터·전략을 재수출하고,
 * 그 전략들이 다시 `@/notification`을 임포트한다. notification은 user-settings를
 * 임포트하므로, user-settings가 메인 배럴을 임포트하면
 * scheduler → notification → user-settings → scheduler 순환이 생긴다.
 *
 * 이 파일은 BullMQ enqueue 심(seam)만 재수출하여 그 순환을 원천 차단한다.
 * 큐 모듈/서비스·잡 이름·페이로드 타입만 로드하며 오케스트레이터/전략/프로세서
 * (→ notification) 그래프를 끌어오지 않으므로, 리마인더 큐만 필요한 모듈은
 * 이 경로를 임포트한다.
 */
export type {
	ReminderHourChangedJobData,
	SocialDigestJobData,
} from "./application/ports/timezone-reminder-enqueuer.port";
export {
	TIMEZONE_REMINDER_QUEUE,
	TimezoneReminderJobName,
} from "./infrastructure/queue/timezone-reminder-queue.constants";
export { TimezoneReminderQueueModule } from "./infrastructure/queue/timezone-reminder-queue.module";
export { TimezoneReminderQueueService } from "./infrastructure/queue/timezone-reminder-queue.service";
