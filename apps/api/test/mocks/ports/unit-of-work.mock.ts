import type { UnitOfWorkPort } from "@/shared/application/ports";

/**
 * UNIT_OF_WORK 포트 mock 팩토리
 *
 * run이 콜백을 즉시 실행하는 passthrough 구현입니다.
 * 콜백이 인자를 받지 않으므로(리포지토리가 CLS에서 tx를 읽는 구조)
 * 스텁 클라이언트 없이 순수 통과만 합니다.
 *
 * @example
 * ```typescript
 * const { unit, unitRef } = await TestBed.solitary(CreateTodoHandler)
 *   .mock<UnitOfWorkPort>(UNIT_OF_WORK)
 *   .impl(() => createUnitOfWorkMock())
 *   .compile();
 * ```
 */
export function createUnitOfWorkMock(): UnitOfWorkPort {
	const run = jest.fn();
	run.mockImplementation((work: () => Promise<unknown>) => work());
	return { run };
}
