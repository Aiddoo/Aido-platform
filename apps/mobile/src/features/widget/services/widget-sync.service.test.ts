import type { ErrorReporter } from '@src/core/ports/error-reporter';

import type { WidgetBridge } from '../bridge/widget-bridge';
import type { WidgetSnapshotContext, WidgetSummaryInput } from './widget-snapshot.mapper';
import { WidgetSyncService } from './widget-sync.service';

function createMockBridge(): jest.Mocked<WidgetBridge> {
  return { writeSnapshot: jest.fn().mockResolvedValue(undefined) };
}

function createMockErrorReporter(): jest.Mocked<ErrorReporter> {
  return {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
}

const context: WidgetSnapshotContext = {
  t: (key) => key,
  locale: 'ko',
  now: new Date('2026-07-12T09:00:00.000Z'),
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

describe('WidgetSyncService', () => {
  it('요약을 스냅샷으로 변환해 브리지에 기록한다', async () => {
    const bridge = createMockBridge();
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(bridge, errorReporter);

    await service.syncSummary(summary, context);

    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'data', totalTodos: 3, completedTodos: 1 }),
    );
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('브리지 실패는 throw하지 않고 관측만 한다 (위젯 실패는 앱에 영향 없음)', async () => {
    const bridge = createMockBridge();
    bridge.writeSnapshot.mockRejectedValue(new Error('native failure'));
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(bridge, errorReporter);

    await expect(service.syncSummary(summary, context)).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feature: 'widget', method: 'syncSummary' }),
    );
  });

  it('로그아웃 시 loggedOut 스냅샷을 기록한다', async () => {
    const bridge = createMockBridge();
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(bridge, errorReporter);

    await service.syncLoggedOut('2026-07-12', context);

    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'loggedOut', totalTodos: 0 }),
    );
  });

  it('로그아웃 기록 실패도 throw하지 않는다', async () => {
    const bridge = createMockBridge();
    bridge.writeSnapshot.mockRejectedValue(new Error('native failure'));
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(bridge, errorReporter);

    await expect(service.syncLoggedOut('2026-07-12', context)).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feature: 'widget', method: 'syncLoggedOut' }),
    );
  });

  it('완료되지 않은 이전 쓰기 이후 로그아웃 스냅샷이 최종 상태가 된다', async () => {
    let finishWrite = () => {};
    let announceWrite = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      announceWrite = resolve;
    });
    const bridge = createMockBridge();
    bridge.writeSnapshot.mockImplementationOnce(async () => {
      announceWrite();
      await firstWrite;
    });
    const service = new WidgetSyncService(bridge, createMockErrorReporter());

    const summaryWrite = service.syncSummary(summary, context);
    await writeStarted;
    const logoutWrite = service.syncLoggedOut(summary.date, context);
    finishWrite();
    await Promise.all([summaryWrite, logoutWrite]);

    expect(bridge.writeSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'loggedOut' }),
    );
  });

  it('대기 중인 오래된 요약은 로그아웃보다 나중에 기록하지 않는다', async () => {
    const bridge = createMockBridge();
    const service = new WidgetSyncService(bridge, createMockErrorReporter());

    await Promise.all([
      service.syncSummary(summary, context),
      service.syncLoggedOut(summary.date, context),
    ]);

    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'loggedOut' }),
    );
  });

  it('표시 내용이 같으면 기록 시각만 달라져도 다시 쓰지 않는다', async () => {
    const bridge = createMockBridge();
    const service = new WidgetSyncService(bridge, createMockErrorReporter());

    await service.syncSummary(summary, context);
    await service.syncSummary(summary, { ...context, now: new Date('2026-07-12T09:01:00.000Z') });

    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it('기록에 실패한 같은 스냅샷은 다음 동기화에서 다시 시도한다', async () => {
    const bridge = createMockBridge();
    bridge.writeSnapshot.mockRejectedValueOnce(new Error('native failure'));
    const service = new WidgetSyncService(bridge, createMockErrorReporter());

    await service.syncSummary(summary, context);
    await service.syncSummary(summary, context);

    expect(bridge.writeSnapshot).toHaveBeenCalledTimes(2);
  });
  it('번역 변환 실패도 인증 흐름으로 throw하지 않는다', async () => {
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(createMockBridge(), errorReporter);

    await expect(
      service.syncSummary(summary, {
        ...context,
        t: () => {
          throw new Error('translation failure');
        },
      }),
    ).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalled();
  });
});
