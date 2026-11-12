import { createAppLoggerStub } from '@src/testing/core';

import { SessionCleanupService } from './session-cleanup.service';

function createPorts() {
  const calls: string[] = [];
  const record = (name: string) => () => {
    calls.push(name);
  };
  return {
    calls,
    ports: {
      queryCache: {
        abandonPendingMutations: record('abandonPendingMutations'),
        clear: record('queryCache'),
        clearQueries: record('clearQueries'),
      },
      persistedQueryCache: { clear: record('persistedQueryCache') },
      drafts: { removeAll: record('drafts') },
      voiceNotes: { removeAll: record('voiceNotes') },
      deviceTimezone: { clear: record('deviceTimezone') },
      pendingRedemption: { clear: record('pendingRedemption') },
      userDeviceData: {
        clearForUser: (accountId: string) => calls.push(`device-data:${accountId}`),
      },
      pushDevice: { requestRelease: record('pushDeviceRelease') },
      signOutEpoch: { advance: record('signOutEpoch') },
      logger: createAppLoggerStub(),
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
      'signOutEpoch',
      'abandonPendingMutations',
      'queryCache',
      'persistedQueryCache',
      'drafts',
      'voiceNotes',
      'deviceTimezone',
      'pendingRedemption',
    ]);
  });

  it('탈퇴 정리는 그 계정의 안내 기록을 지운다', () => {
    // Given
    const { calls, ports } = createPorts();

    // When
    new SessionCleanupService(ports).afterAccountDeleted('user-1');

    // Then
    expect(calls).toEqual(['device-data:user-1']);
  });

  it('세션 만료 정리는 캐시를 지우고 서버에 알리지 못한 이 기기의 푸시 해제를 요청하며 초안과 녹음은 남긴다', () => {
    // Given
    const { calls, ports } = createPorts();

    // When
    new SessionCleanupService(ports).afterSessionExpired();

    // Then
    expect(calls).toEqual([
      'abandonPendingMutations',
      'queryCache',
      'persistedQueryCache',
      'pushDeviceRelease',
    ]);
  });

  it('로그인한 적 없는 시작과 판정 실패는 캐시만 지우고 기기의 푸시 등록은 건드리지 않는다', () => {
    // Given
    const { calls, ports } = createPorts();

    // When
    new SessionCleanupService(ports).afterSessionEnded();

    // Then
    expect(calls).toEqual(['abandonPendingMutations', 'queryCache', 'persistedQueryCache']);
  });

  it('로그인 직전 정리는 조회 캐시만 비운다', () => {
    // Given
    const { calls, ports } = createPorts();

    // When
    new SessionCleanupService(ports).beforeSignIn();

    // Then
    expect(calls).toEqual(['clearQueries']);
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
    expect(calls).toEqual([
      'signOutEpoch',
      'abandonPendingMutations',
      'persistedQueryCache',
      'drafts',
      'voiceNotes',
      'deviceTimezone',
      'pendingRedemption',
    ]);
    expect(ports.logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ step: 'query-cache' }),
    );
  });
});
