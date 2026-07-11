/**
 * BullMQ Job 테스트 헬퍼
 *
 * no-cast 가드 범위(src/**) 밖인 test/에 목 캐스트를 격리한다.
 * 프로세서 단위 테스트가 최소 Job 목을 타입 캐스트 없이 생성할 수 있게 한다.
 */
import type { Job } from "bullmq";

/** 프로세서 테스트용 최소 Job 목 (사용되는 필드만 채운다) */
export function createMockJob<T>(name: string, data: T): Job<T> {
	return {
		name,
		data,
		updateProgress: jest.fn().mockResolvedValue(undefined),
	} as unknown as Job<T>;
}

/**
 * 좁은 타입의 반환값을 허용하기 위한 목 캐스트 헬퍼.
 * DeepMockProxy/@suites 목 메서드의 엄격한 인자 타입을 느슨하게 한다.
 */
export function asMock(fn: unknown): jest.Mock {
	return fn as jest.Mock;
}
