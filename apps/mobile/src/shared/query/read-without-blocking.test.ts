import { setupFakeTimersPerTest } from '@src/testing/timers';
import { noop } from 'es-toolkit';

import { readWithoutBlocking } from './read-without-blocking';

const READ_TIMEOUT_MS = 3_000;

describe('readWithoutBlocking', () => {
  setupFakeTimersPerTest();

  it('연결이 있어도 응답이 오지 않으면 제한 시간 뒤 없는 값으로 이어 간다', async () => {
    // Given
    const result = readWithoutBlocking(undefined, () => new Promise(() => undefined), noop);

    // When
    await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS);

    // Then
    await expect(result).resolves.toBeNull();
  });
});
