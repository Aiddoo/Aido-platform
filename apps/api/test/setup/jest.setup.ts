/**
 * Jest 전역 설정
 *
 * 모든 테스트에 적용되는 공통 설정
 */
import "@/common/date/dayjs.setup";
import { resetAllFixtures } from "@test/fixtures";

/**
 * 각 테스트 후 Mock 초기화
 */
afterEach(() => {
	jest.clearAllMocks();
});

/**
 * 각 테스트 파일 종료 후 Fixture 카운터 리셋
 */
afterAll(() => {
	resetAllFixtures();
});

/**
 * 전역 타임아웃 설정 (필요시)
 */
// jest.setTimeout(30000);

/**
 * 콘솔 에러/경고 숨기기 (필요시)
 */
// const originalError = console.error;
// const originalWarn = console.warn;
//
// beforeAll(() => {
//   console.error = jest.fn();
//   console.warn = jest.fn();
// });
//
// afterAll(() => {
//   console.error = originalError;
//   console.warn = originalWarn;
// });
