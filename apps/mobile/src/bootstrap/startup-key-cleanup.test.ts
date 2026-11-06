import { runStartupKeyCleanup } from './startup-key-cleanup';

describe('runStartupKeyCleanup', () => {
  it('한 정리가 실패해도 나머지를 계속하고 실패를 남긴다', () => {
    // Given
    const logger = { warn: jest.fn() };
    const next = jest.fn();

    // When
    runStartupKeyCleanup(
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
