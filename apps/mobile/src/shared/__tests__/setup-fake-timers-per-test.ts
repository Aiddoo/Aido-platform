import { cleanup } from '@testing-library/react-native';

type FakeTimersConfig = Parameters<typeof jest.useFakeTimers>[0];

/**
 * 테스트마다 fake timer를 켜고 끈다. Jest와 Testing Library가 권하는 정리 순서를 한 곳에 둔다.
 *
 * Jest는 안쪽 describe의 afterEach를 바깥(jest.setup.ts)보다 먼저 부른다. 파일에서 바로
 * `jest.useRealTimers()`를 부르면 공용 cleanup이 화면을 내릴 때 생기는 타이머(토스트 자동 닫힘,
 * 늦은 녹음 대기)가 진짜 타이머로 남아 worker가 끝나지 못한다. 그래서
 * 1. fake timer가 켜진 채 화면을 내리고
 * 2. 남은 타이머를 한 번 흘려 정리 콜백을 끝낸 뒤
 * 3. 진짜 타이머로 돌아간다
 *
 * @see https://jestjs.io/docs/timer-mocks
 * @see https://testing-library.com/docs/using-fake-timers/
 */
export function setupFakeTimersPerTest(config?: FakeTimersConfig) {
  beforeEach(() => {
    jest.useFakeTimers(config);
  });

  afterEach(async () => {
    await cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
}
