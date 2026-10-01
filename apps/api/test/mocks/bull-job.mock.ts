import type { Job } from "bullmq";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

/**
 * 프로세서 테스트용 최소 Job 목 (사용되는 필드만 채운다).
 *
 * 잡 이름 리터럴(N)을 반환 타입에 보존하여, discriminated union 기반 프로세서
 * (`process(job: 특정잡유니온)`)에도 캐스트 없이 전달할 수 있게 한다.
 */

export function createMockJob<T, N extends string = string>(name: N, data: T): Job<T, unknown, N> {
	const job = mock<Job<T, unknown, N>>();
	Object.defineProperties(job, {
		name: { value: name, configurable: true },
		data: { value: data, configurable: true },
	});
	job.updateProgress.mockResolvedValue(undefined);
	return job;
}

export function asMock<T extends (...args: never[]) => unknown>(fn: T) {
	return vi.mocked(fn, { partial: true });
}
