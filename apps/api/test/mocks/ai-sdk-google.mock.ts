/**
 * @ai-sdk/google Mock
 *
 * v4부터 ESM-only 빌드라 jest 29(CJS)에서 로드할 수 없는 문제를 해결하기
 * 위한 모킹. createGoogleGenerativeAI(설정) → 모델 팩토리 형태만 재현한다.
 */

export const createGoogleGenerativeAI = jest.fn(() => jest.fn(() => "mock-google-model"));
