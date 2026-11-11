import { toInstant } from '@src/shared/date/instant';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import { createErrorReporterStub, createMemorySyncStorage } from '@src/testing/core';

import type { WidgetSnapshotContext, WidgetSummaryInput } from '../apis/widget-snapshot.mapper';
import type { WidgetBridge } from '../bridge/widget-bridge';
import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';
import { WidgetSyncService } from './widget-sync.service';

function createWidgetBridgeStub(): jest.Mocked<WidgetBridge> {
  return { writeSnapshot: jest.fn().mockResolvedValue(undefined) };
}

const context: WidgetSnapshotContext = {
  t: (key) => key,
  locale: 'ko',
  now: toInstant('2026-07-12T09:00:00.000Z'),
  timeZone: 'Asia/Seoul',
};

const summary: WidgetSummaryInput = {
  date: '2026-07-12',
  totalTodos: 3,
  completedTodos: 1,
  completionRate: 33,
  isComplete: false,
  currentStreak: 2,
  topTodos: [],
};

function createService(bridge: WidgetBridge, errorReporter = createErrorReporterStub()) {
  const widgetStorage = createMemorySyncStorage();

  return {
    errorReporter,
    widgetStorage,
    service: new WidgetSyncService(bridge, errorReporter, widgetStorage),
  };
}

describe('WidgetSyncService', () => {
  it('요약을 스냅샷으로 변환해 브리지에 기록한다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service, errorReporter } = createService(bridge);

    // When
    await service.syncSummary({ today: summary }, context);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        days: [expect.objectContaining({ state: 'data', totalTodos: 3, completedTodos: 1 })],
      }),
      null,
    );
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('브리지 실패는 throw하지 않고 관측만 한다 (위젯 실패는 앱에 영향 없음)', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    bridge.writeSnapshot.mockRejectedValue(new Error('native failure'));
    const { service, errorReporter } = createService(bridge);

    // When
    const result = service.syncSummary({ today: summary }, context);

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feature: 'widget', method: 'syncSummary' }),
    );
  });

  it('로그아웃 시 loggedOut 스냅샷을 기록한다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);

    // When
    await service.syncLoggedOut('2026-07-12', context);

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
    const { service, errorReporter } = createService(bridge);

    // When
    const result = service.syncLoggedOut('2026-07-12', context);

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feature: 'widget', method: 'syncLoggedOut' }),
    );
  });

  it('완료되지 않은 이전 쓰기 이후 로그아웃 스냅샷이 최종 상태가 된다', async () => {
    // Given
    let finishWrite = () => {};
    let announceWrite = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      announceWrite = resolve;
    });
    const bridge = createWidgetBridgeStub();
    bridge.writeSnapshot.mockImplementationOnce(async () => {
      announceWrite();
      await firstWrite;
    });
    const { service } = createService(bridge);

    // When
    const summaryWrite = service.syncSummary({ today: summary }, context);
    await writeStarted;
    const logoutWrite = service.syncLoggedOut(summary.date, context);
    finishWrite();
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
    await Promise.all([
      service.syncSummary({ today: summary }, context),
      service.syncLoggedOut(summary.date, context),
    ]);

    // Then
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
    await service.syncSummary({ today: summary }, context);
    await service.syncSummary(
      { today: summary },
      { ...context, now: toInstant('2026-07-12T09:01:00.000Z') },
    );

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it('표시 내용이 같아도 기기 시간대가 바뀌면 자정 경계를 다시 계산하도록 다시 쓴다', async () => {
    // Given
    // 서울에서 같은 날짜의 요약을 이미 기록했다
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);
    await service.syncSummary({ today: summary }, context);

    // When
    // 같은 날짜 그대로 런던 시간대로 바뀐다
    await service.syncSummary({ today: summary }, { ...context, timeZone: 'Europe/London' });

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
    await service.syncSummary({ today: summary }, context);
    await service.syncSummary({ today: summary }, context);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(2);
  });

  it('번역 변환 실패도 인증 흐름으로 throw하지 않는다', async () => {
    // Given
    const { service, errorReporter } = createService(createWidgetBridgeStub());

    // When
    const result = service.syncSummary(
      { today: summary },
      {
        ...context,
        t: () => {
          throw new Error('translation failure');
        },
      },
    );

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalled();
  });

  it('같은 표시 내용이어도 계정이 바뀌면 소유자와 함께 다시 기록한다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);

    // When
    await service.syncSummary({ today: summary }, { ...context, userId: 'previous-user' });
    await service.syncSummary({ today: summary }, { ...context, userId: 'current-user' });

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(2);
    expect(bridge.writeSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ days: [expect.objectContaining({ state: 'data' })] }),
      'current-user',
    );
  });

  it('로그아웃은 이전 컨텍스트의 계정 식별자를 위젯으로 전달하지 않는다', async () => {
    // Given
    const bridge = createWidgetBridgeStub();
    const { service } = createService(bridge);

    // When
    await service.syncLoggedOut(summary.date, { ...context, userId: 'previous-user' });

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ days: [expect.objectContaining({ state: 'loggedOut' })] }),
      null,
    );
  });

  it('앱 없이 깨어난 위젯이 남긴 실패를 다음 시작에 한 번만 보고한다', () => {
    // Given
    const { service, errorReporter, widgetStorage } = createService(createWidgetBridgeStub());
    writeStoredValue(widgetStorage, widgetHeadlessFailureStoredValue, {
      method: 'handleWidgetTask',
      name: 'TypeError',
      message: 'activity unavailable',
    });

    // When
    service.reportHeadlessFailure();
    service.reportHeadlessFailure();

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TypeError', message: 'activity unavailable' }),
      { feature: 'widget', method: 'handleWidgetTask' },
    );
  });

  it('남긴 실패가 없으면 보고하지 않는다', () => {
    // Given
    const { service, errorReporter } = createService(createWidgetBridgeStub());

    // When
    service.reportHeadlessFailure();

    // Then
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });
});
