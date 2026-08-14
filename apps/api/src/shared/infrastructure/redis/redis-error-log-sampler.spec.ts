/**
 * RedisErrorLogSampler 단위 테스트
 *
 * @description
 * Redis 장애 중 요청마다 에러가 발생해도 로그가 폭발하지 않도록
 * 윈도우당 1회만 warn하고 나머지는 억제 카운트로 집계하는지 검증합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test redis-error-log-sampler
 * ```
 */
import { RedisErrorLogSampler } from "./redis-error-log-sampler";

describe("RedisErrorLogSampler — Redis 에러 로그 샘플러", () => {
	let warn: jest.Mock;

	beforeEach(() => {
		jest.useFakeTimers();
		warn = jest.fn();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("첫 에러는 즉시 warn 로그를 남긴다", () => {
		// Given
		const sampler = new RedisErrorLogSampler({ warn }, 30_000);

		// When
		sampler.warn("GET", new Error("Connection is closed."));

		// Then
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("Connection is closed."));
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("GET"));
	});

	it("윈도우 내 반복 에러는 억제한다 (로그 1회만)", () => {
		// Given
		const sampler = new RedisErrorLogSampler({ warn }, 30_000);

		// When — 같은 윈도우 안에서 100회 에러
		for (let i = 0; i < 100; i++) {
			sampler.warn("GET", new Error("boom"));
		}

		// Then
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it("윈도우가 지나면 억제된 개수와 함께 다시 로그를 남긴다", () => {
		// Given
		const sampler = new RedisErrorLogSampler({ warn }, 30_000);
		for (let i = 0; i < 5; i++) {
			sampler.warn("GET", new Error("boom"));
		}

		// When — 윈도우 경과 후 새 에러
		jest.advanceTimersByTime(30_000);
		sampler.warn("SET", new Error("still down"));

		// Then
		expect(warn).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenLastCalledWith(expect.stringContaining("+4 suppressed"));
	});

	it("Error가 아닌 값도 메시지로 변환한다", () => {
		// Given
		const sampler = new RedisErrorLogSampler({ warn }, 30_000);

		// When
		sampler.warn("DEL", "raw string error");

		// Then
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("raw string error"));
	});
});
