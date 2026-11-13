import { toInstant } from '@src/shared/date/instant';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import { createMemorySyncStorage, createWidgetBridgeStub } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';

import type { WidgetSnapshotContext, WidgetSummaryInput } from '../apis/widget-snapshot.mapper';
import type { WidgetBridge } from '../bridge/widget-bridge';
import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';
import { WidgetSyncService } from './widget-sync.service';

const context: WidgetSnapshotContext = {
  t: (key) => key,
  locale: 'ko',
  now: toInstant('2026-07-12T09:00:00.000Z'),
  timeZone: 'Asia/Seoul',
};

const summary: WidgetSummaryInput = {
  date: createDateKey('2026-07-12'),
  totalTodos: 3,
  completedTodos: 1,
  completionRate: 33,
  isComplete: false,
  currentStreak: 2,
  topTodos: [],
};

const USER_ID = 'current-user';

function createService(bridge: WidgetBridge) {
  const widgetStorage = createMemorySyncStorage();

  return { widgetStorage, service: new WidgetSyncService(bridge, widgetStorage) };
}

describe('WidgetSyncService', () => {
  it('요약을 스냅샷으로 변환해 브리지에 기록한다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);

    // When
    const result = await service.syncSummary({ today: summary }, context, USER_ID);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        days: [expect.objectContaining({ state: 'data', totalTodos: 3, completedTodos: 1 })],
      }),
      USER_ID,
    );
    expect(result).toEqual({ status: 'written', snapshot: expect.anything() });
  });

  it('브리지 실패는 throw하지 않고 실패 결과로 돌려준다 (위젯 실패는 앱에 영향 없음)', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    bridge.writeSnapshot.mockRejectedValue(new Error('native failure'));
    const { service } = createService(bridge);

    // When
    const result = service.syncSummary({ today: summary }, context, USER_ID);

    // Then
    await expect(result).resolves.toEqual({
      status: 'failed',
      error: expect.objectContaining({ message: 'native failure' }),
    });
  });

  it('로그아웃 시 loggedOut 스냅샷을 기록한다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);

    // When
    await service.syncLoggedOut(createDateKey('2026-07-12'), context);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        days: [expect.objectContaining({ state: 'loggedOut', totalTodos: 0 })],
      }),
      null,
    );
  });

  it('로그아웃 기록 실패도 throw하지 않는다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    bridge.writeSnapshot.mockRejectedValue(new Error('native failure'));
    const { service } = createService(bridge);

    // When
    const result = service.syncLoggedOut(createDateKey('2026-07-12'), context);

    // Then
    await expect(result).resolves.toEqual({ status: 'failed', error: expect.any(Error) });
  });

  it('완료되지 않은 이전 쓰기 이후 로그아웃 스냅샷이 최종 상태가 된다', async () => {
    // Given
    const firstWrite = Promise.withResolvers<void>();
    const writeStarted = Promise.withResolvers<void>();
    const bridge = createWidgetBridgeStub();
    bridge.writeSnapshot.mockImplementationOnce(async () => {
      writeStarted.resolve();
      await firstWrite.promise;
    });
    const { service } = createService(bridge);

    // When
    const summaryWrite = service.syncSummary({ today: summary }, context, USER_ID);
    await writeStarted.promise;
    const logoutWrite = service.syncLoggedOut(summary.date, context);
    firstWrite.resolve();
    await Promise.all([summaryWrite, logoutWrite]);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ days: [expect.objectContaining({ state: 'loggedOut' })] }),
      null,
    );
  });

  it('대기 중인 오래된 요약은 로그아웃보다 나중에 기록하지 않는다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);

    // When
    const results = await Promise.all([
      service.syncSummary({ today: summary }, context, USER_ID),
      service.syncLoggedOut(summary.date, context),
    ]);

    // Then
    expect(results.map(({ status }) => status)).toEqual(['superseded', 'written']);
    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ days: [expect.objectContaining({ state: 'loggedOut' })] }),
      null,
    );
  });

  it('표시 내용이 같으면 기록 시각만 달라져도 다시 쓰지 않는다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);

    // When
    await service.syncSummary({ today: summary }, context, USER_ID);
    const repeated = await service.syncSummary(
      { today: summary },
      { ...context, now: toInstant('2026-07-12T09:01:00.000Z') },
      USER_ID,
    );

    // Then
    expect(repeated).toEqual({ status: 'unchanged' });
    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it('표시 내용이 같아도 기기 시간대가 바뀌면 자정 경계를 다시 계산하도록 다시 쓴다', async () => {
    // Given
    // 서울에서 같은 날짜의 요약을 이미 기록했다
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);
    await service.syncSummary({ today: summary }, context, USER_ID);

    // When
    // 같은 날짜 그대로 런던 시간대로 바뀐다
    await service.syncSummary(
      { today: summary },
      { ...context, timeZone: 'Europe/London' },
      USER_ID,
    );

    // Then
    // iOS timeline의 다음 자정이 새 시간대 기준이 되도록 다시 기록한다
    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(2);
  });

  it('기록에 실패한 같은 스냅샷은 다음 동기화에서 다시 시도한다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    bridge.writeSnapshot.mockRejectedValueOnce(new Error('native failure'));
    const { service } = createService(bridge);

    // When
    await service.syncSummary({ today: summary }, context, USER_ID);
    await service.syncSummary({ today: summary }, context, USER_ID);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(2);
  });

  it('번역 변환 실패도 인증 흐름으로 throw하지 않는다', async () => {
    // Given
    const { service } = createService(createWidgetBridgeStub());

    // When
    const result = service.syncSummary(
      { today: summary },
      {
        ...context,
        t: () => {
          throw new Error('translation failure');
        },
      },
      USER_ID,
    );

    // Then
    await expect(result).resolves.toEqual({ status: 'failed', error: expect.any(Error) });
  });

  it('같은 표시 내용이어도 계정이 바뀌면 소유자와 함께 다시 기록한다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);

    // When
    await service.syncSummary({ today: summary }, context, 'previous-user');
    await service.syncSummary({ today: summary }, context, 'current-user');

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(2);
    expect(bridge.writeSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ days: [expect.objectContaining({ state: 'data' })] }),
      'current-user',
    );
  });

  it('로그아웃은 앞서 쓴 계정 식별자를 위젯으로 전달하지 않는다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);
    await service.syncSummary({ today: summary }, context, 'previous-user');

    // When
    await service.syncLoggedOut(summary.date, context);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ days: [expect.objectContaining({ state: 'loggedOut' })] }),
      null,
    );
  });

  it('앱 없이 깨어난 위젯이 남긴 실패를 다음 시작에 한 번만 꺼낸다', () => {
    // Given
    const { service, widgetStorage } = createService(createWidgetBridgeStub());
    writeStoredValue(widgetStorage, widgetHeadlessFailureStoredValue, {
      method: 'handleWidgetTask',
      name: 'TypeError',
      message: 'activity unavailable',
    });

    // When
    const first = service.takeHeadlessFailure();
    const second = service.takeHeadlessFailure();

    // Then
    expect(first).toEqual({
      error: expect.objectContaining({ name: 'TypeError', message: 'activity unavailable' }),
      method: 'handleWidgetTask',
    });
    expect(second).toBeNull();
  });
});
