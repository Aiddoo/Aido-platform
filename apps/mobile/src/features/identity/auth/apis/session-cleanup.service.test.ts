import { SessionCleanupService } from './session-cleanup.service';

function createPorts() {
  const calls: string[] = [];
  const record = (name: string) => () => {
    calls.push(name);
  };
  return {
    calls,
    ports: {
      queryCache: { clear: record('queryCache') },
      persistedQueryCache: { clear: record('persistedQueryCache') },
      drafts: { removeAll: record('drafts') },
      voiceNotes: { removeAll: record('voiceNotes') },
      deviceTimezone: { clear: record('deviceTimezone') },
      logger: { warn: jest.fn() },
    },
  };
}

describe('SessionCleanupService', () => {
  it('로그아웃 정리는 캐시와 이 계정의 기기 데이터를 모두 지운다', () => {
    // Given
    const { calls, ports } = createPorts();

    // When
    new SessionCleanupService(ports).afterSignedOut();

    // Then
    expect(calls).toEqual([
      'queryCache',
      'persistedQueryCache',
      'drafts',
      'voiceNotes',
      'deviceTimezone',
    ]);
  });

  it('세션 만료 정리는 캐시만 지우고 초안과 녹음은 남긴다', () => {
    // Given
    const { calls, ports } = createPorts();

    // When
    new SessionCleanupService(ports).afterSessionEnded();

    // Then
    expect(calls).toEqual(['queryCache', 'persistedQueryCache']);
  });

  it('한 단계가 실패해도 나머지를 지우고 실패를 남긴다', () => {
    // Given
    const { calls, ports } = createPorts();
    ports.queryCache.clear = () => {
      throw new Error('캐시 실패');
    };

    // When
    new SessionCleanupService(ports).afterSignedOut();

    // Then
    expect(calls).toEqual(['persistedQueryCache', 'drafts', 'voiceNotes', 'deviceTimezone']);
    expect(ports.logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ step: 'query-cache' }),
    );
  });
});
