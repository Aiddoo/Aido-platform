/**
 * Suites 테스트 유틸리티
 *
 * NestJS 공식 권장 Suites 라이브러리를 활용한 테스트 설정
 * 자동 Mock 생성으로 보일러플레이트 제거
 *
 * @see https://docs.nestjs.com/recipes/suites
 * @see https://github.com/suites-dev/suites
 *
 * @example
 * ```typescript
 * import { TestBed, Mocked } from '@suites/unit';
 *
 * describe('SessionService', () => {
 *   let service: SessionService;
 *   let userRepo: Mocked<UserRepository>;
 *
 *   beforeEach(async () => {
 *     const { unit, unitRef } = await TestBed.solitary(SessionService).compile();
 *     service = unit;
 *     userRepo = unitRef.get(UserRepository);
 *   });
 * });
 * ```
 */

export type { Mocked } from "@suites/doubles.jest";
// Suites 타입 재export
export { TestBed } from "@suites/unit";

/**
 * Suites 사용 가이드
 *
 * 1. 단순 서비스 테스트: Suites TestBed 사용 (자동 mock)
 * 2. Repository 테스트: 자체 헬퍼(createMockPrisma 등) + Prismock 사용
 */
