/**
 * runInBackground 단위 테스트
 *
 * @description
 * BullMQ 스케줄러 등록 등 Redis 의존 부트 작업이 앱 기동을 블로킹하지
 * 않도록 하는 fire-and-forget 헬퍼를 검증합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test non-blocking-init
 * ```
 */
import { runInBackground } from "./non-blocking-init";

describe("runInBackground — 부팅 논블로킹 초기화", () => {
	it("작업이 pending이어도 즉시 프로미스를 반환한다 (블로킹 없음)", () => {
		// Given — Redis 다운: 영원히 pending인 작업
		const logger = { error: jest.fn() };
		const neverResolves = () => new Promise<void>(() => {});

		// When — 동기적으로 반환되는지 (await 없이)
		const result = runInBackground(logger, "test", neverResolves);

		// Then
		expect(result).toBeInstanceOf(Promise);
	});

	it("작업 성공 시 에러 로그를 남기지 않는다", async () => {
		// Given
		const logger = { error: jest.fn() };
		const task = jest.fn().mockResolvedValue(undefined);

		// When
		await runInBackground(logger, "test", task);

		// Then
		expect(task).toHaveBeenCalledTimes(1);
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("동기 throw도 호출부로 전파하지 않고 로그만 남긴다 (부트스트랩 크래시 방지)", async () => {
		// Given — 프로미스를 반환하기 전에 동기적으로 터지는 작업
		const logger = { error: jest.fn() };
		const task = (): Promise<void> => {
			throw new Error("sync boom");
		};

		// When / Then — 호출 자체가 throw하면 안 된다
		await expect(
			runInBackground(logger, "Scheduler registration", task),
		).resolves.toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("sync boom"),
		);
	});

	it("작업 실패 시 reject하지 않고 에러 로그만 남긴다 (unhandled rejection 방지)", async () => {
		// Given
		const logger = { error: jest.fn() };
		const task = () => Promise.reject(new Error("Connection is closed."));

		// When / Then — reject되지 않아야 한다
		await expect(
			runInBackground(logger, "Scheduler registration", task),
		).resolves.toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Scheduler registration failed"),
		);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Connection is closed."),
		);
	});
});
