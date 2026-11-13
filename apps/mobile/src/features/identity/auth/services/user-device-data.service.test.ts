import { createAppLoggerStub } from '@src/testing/core';

import { UserDeviceDataService } from './user-device-data.service';

describe('UserDeviceDataService', () => {
  it('한 저장소가 실패해도 나머지 저장소에서 그 계정 기록을 지우고 실패를 남긴다', () => {
    // Given
    const cleared: string[] = [];
    const logger = createAppLoggerStub();
    const service = new UserDeviceDataService({
      repositories: {
        broken: {
          clear: () => {
            throw new Error('storage unavailable');
          },
        },
        coachmark: { clear: (userId) => cleared.push(`coachmark:${userId}`) },
      },
      logger,
    });

    // When
    service.clearForUser('user-1');

    // Then
    expect(cleared).toEqual(['coachmark:user-1']);
    expect(logger.warn).toHaveBeenCalledWith('auth.user-device-data.clear-failed', {
      repository: 'broken',
      error: 'storage unavailable',
    });
  });
});
