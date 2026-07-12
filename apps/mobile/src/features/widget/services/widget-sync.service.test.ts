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
    // Given
    const bridge = createMockBridge();
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(bridge, errorReporter);

    // When
    await service.syncSummary(summary, context);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'data', totalTodos: 3, completedTodos: 1 }),
    );
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('브리지 실패는 throw하지 않고 관측만 한다 (위젯 실패는 앱에 영향 없음)', async () => {
    // Given
    const bridge = createMockBridge();
    bridge.writeSnapshot.mockRejectedValue(new Error('native failure'));
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(bridge, errorReporter);

    // When / Then - throw하지 않는다
    await expect(service.syncSummary(summary, context)).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feature: 'widget', method: 'syncSummary' }),
    );
  });

  it('로그아웃 시 loggedOut 스냅샷을 기록한다', async () => {
    // Given
    const bridge = createMockBridge();
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(bridge, errorReporter);

    // When
    await service.syncLoggedOut('2026-07-12', context);

    // Then
    expect(bridge.writeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'loggedOut', totalTodos: 0 }),
    );
  });

  it('로그아웃 기록 실패도 throw하지 않는다', async () => {
    // Given
    const bridge = createMockBridge();
    bridge.writeSnapshot.mockRejectedValue(new Error('native failure'));
    const errorReporter = createMockErrorReporter();
    const service = new WidgetSyncService(bridge, errorReporter);

    // When / Then
    await expect(service.syncLoggedOut('2026-07-12', context)).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feature: 'widget', method: 'syncLoggedOut' }),
    );
  });
});
