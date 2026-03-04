/**
 * E2E 테스트용 Mock BullMQ Queue
 *
 * BullMQ Worker/Scheduler 없이 큐 연산을 안전하게 no-op 처리합니다.
 * @InjectQueue() 주입 대상 전체를 대체합니다.
 */
export function createMockBullQueue() {
	return {
		add: jest.fn().mockResolvedValue({ id: "mock-job-id", name: "mock" }),
		addBulk: jest.fn().mockResolvedValue([]),
		getJob: jest.fn().mockResolvedValue(null),
		upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
		removeJobScheduler: jest.fn().mockResolvedValue(undefined),
		getJobCounts: jest
			.fn()
			.mockResolvedValue({ active: 0, waiting: 0, failed: 0 }),
		getJobSchedulers: jest.fn().mockResolvedValue([]),
		isPaused: jest.fn().mockResolvedValue(false),
		close: jest.fn().mockResolvedValue(undefined),
		drain: jest.fn().mockResolvedValue(undefined),
		obliterate: jest.fn().mockResolvedValue(undefined),
		name: "mock-queue",
	};
}
