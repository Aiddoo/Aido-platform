/**
 * Scheduler 모듈 공개 배럴 (클린아키텍처 경계).
 *
 * 외부 모듈은 이 배럴만 임포트한다 (내부 레이어 딥 임포트 금지 — check-boundaries).
 */

// --- Ports (todo 리마인더 예약 · user-settings enqueue 계약) ---
export {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
	type ReminderCancellationResult,
} from "./application/ports/reminder-scheduler.port";
export {
	type ReminderHourChangedJobData,
	type SocialDigestJobData,
	TIMEZONE_REMINDER_ENQUEUER,
	type TimezoneReminderEnqueuerPort,
} from "./application/ports/timezone-reminder-enqueuer.port";
// --- Orchestrator (e2e/통합 테스트 부팅용) ---
export { TimezoneAwareReminderOrchestrator } from "./application/services/timezone-aware-reminder.orchestrator";
// --- Strategies (통합 테스트) ---
export * from "./application/strategies";
// --- Todo 리마인더 프로세서 (e2e/통합 테스트 부팅용) ---
export { TodoReminderProcessor } from "./infrastructure/processors/todo-reminder.processor";
// --- Queue (user-settings enqueuer · health · e2e) ---
export {
	TIMEZONE_REMINDER_QUEUE,
	TimezoneReminderJobName,
	TimezoneReminderProcessor,
	TimezoneReminderQueueModule,
	TimezoneReminderQueueService,
} from "./infrastructure/queue";
// --- Reminder scheduler 큐 이름 (health · e2e) ---
export {
	type ReminderJobData,
	TODO_REMINDER_QUEUE,
} from "./infrastructure/scheduler/bullmq-reminder-scheduler.adapter";
// --- Module ---
export { SchedulerModule } from "./scheduler.module";
