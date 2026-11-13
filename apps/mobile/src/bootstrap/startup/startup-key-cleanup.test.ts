import { createAppLoggerStub } from '@src/testing/core';

import { cleanStartupKeys } from './startup-key-cleanup';

describe('cleanStartupKeys', () => {
  it('한 정리가 실패해도 나머지를 계속하고 실패를 남긴다', () => {
    // Given
    const logger = createAppLoggerStub();
    const next = jest.fn();

    // When
    cleanStartupKeys(
      {
        failing: () => {
          throw new Error('storage unavailable');
        },
        next,
      },
      logger,
    );

    // Then
    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('bootstrap.startup-key-cleanup.failed', {
      step: 'failing',
      error: 'storage unavailable',
    });
  });
});
