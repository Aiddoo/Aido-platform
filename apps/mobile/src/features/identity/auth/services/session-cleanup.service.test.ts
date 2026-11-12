import { createAppLoggerStub, createPushNotificationGatewayStub } from '@src/testing/core';
import { waitFor } from '@testing-library/react-native';

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
      pushNotification: createPushNotificationGatewayStub(),
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

  it('탈퇴 뒤 로그아웃 정리는 그 계정의 안내 기록까지 지운다', () => {
    // Given
    const { calls, ports } = createPorts();
    const service = new SessionCleanupService(ports);
    service.beforeAccountDeletion('user-1');

    // When
    service.afterSignedOut();

    // Then
    expect(calls.at(-1)).toBe('device-data:user-1');
  });

  it.each([
    ['결과를 모르는 탈퇴', () => undefined, true],
    [
      '서버가 거절한 탈퇴',
      (service: SessionCleanupService) => service.afterAccountDeletionRejected(),
      false,
    ],
  ])('%s 뒤 세션이 만료되면 초안을 지우는지가 갈린다', (_name, settle, removesDrafts) => {
    // Given
    const { calls, ports } = createPorts();
    const service = new SessionCleanupService(ports);
    service.beforeAccountDeletion('user-1');
    settle(service);

    // When
    service.afterSessionExpired();

    // Then
    expect(calls.includes('drafts')).toBe(removesDrafts);
    expect(calls.includes('device-data:user-1')).toBe(removesDrafts);
    expect(calls.at(-1)).toBe('pushDeviceRelease');
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

  it.each([
    ['로그아웃·탈퇴', 'afterSignedOut', 1],
    ['세션 만료(다음에 다른 계정이 로그인할 수 있다)', 'afterSessionExpired', 1],
    ['로그인한 적 없는 시작·판정 실패', 'afterSessionEnded', 0],
  ] as const)('%s 정리(%s)는 기기 알림 센터에 도착한 알림을 %s번 지운다', (_, cleanup, times) => {
    // Given
    const { ports } = createPorts();

    // When
    new SessionCleanupService(ports)[cleanup]();

    // Then
    expect(ports.pushNotification.dismissDelivered).toHaveBeenCalledTimes(times);
  });

  it('알림 센터를 지우지 못해도 나머지를 지우고 실패를 남긴다', async () => {
    // Given
    const { calls, ports } = createPorts();
    ports.pushNotification.dismissDelivered.mockRejectedValue(new Error('알림 센터 실패'));

    // When
    new SessionCleanupService(ports).afterSignedOut();

    // Then
    expect(calls).toContain('pendingRedemption');
    await waitFor(() =>
      expect(ports.logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ step: 'delivered-notifications' }),
      ),
    );
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
