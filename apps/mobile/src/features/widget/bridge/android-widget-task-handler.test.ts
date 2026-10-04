import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { createWidgetNavigationRepository } from '../services/widget-navigation.repository';
import { createAndroidWidgetTaskHandler } from './android-widget-task-handler';
import { ANDROID_WIDGET_NAVIGATION_ACTION } from './android-widget.constant';
import { renderStoredAndroidWidget } from './android-widgets.bridge';
import type { WidgetNavigationStorage } from './widget-navigation-storage';

jest.mock('./android-widgets.bridge', () => ({ renderStoredAndroidWidget: jest.fn() }));

function createHandler(isAppActive = false) {
  const values = new Map<string, string>();
  const storage: WidgetNavigationStorage = {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
    subscribe: () => () => {},
  };
  const navigationRepository = createWidgetNavigationRepository(storage);
  const openApp = jest.fn(async () => {});
  const errorReporter: jest.Mocked<ErrorReporter> = {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
  return {
    navigationRepository,
    openApp,
    errorReporter,
    handler: createAndroidWidgetTaskHandler({
      navigationRepository,
      openApp,
      isAppActive: () => isAppActive,
      now: () => 1000,
      createCommandId: () => 'widget-tap',
      errorReporter,
    }),
  };
}

function createTask(overrides: Partial<WidgetTaskHandlerProps> = {}): WidgetTaskHandlerProps {
  return {
    widgetInfo: {
      widgetName: 'AidoTodayLarge',
      widgetId: 12,
      width: 340,
      height: 380,
      screenInfo: { screenHeightDp: 800, screenWidthDp: 400, density: 2, densityDpi: 320 },
    },
    widgetAction: 'WIDGET_CLICK',
    clickAction: ANDROID_WIDGET_NAVIGATION_ACTION,
    clickActionData: { uri: 'aido://todo/12', userId: 'widget-owner' },
    renderWidget: jest.fn(),
    ...overrides,
  };
}

describe('Android 위젯 작업 처리', () => {
  it('종료된 앱을 열기 전에 정확한 목적지와 위젯 소유자를 저장한다', async () => {
    // Given
    const { handler, navigationRepository, openApp } = createHandler();
    openApp.mockImplementation(async () => {
      expect(navigationRepository.getPendingCommand()).toEqual({
        id: 'widget-tap',
        uri: 'aido://todo/12',
        userId: 'widget-owner',
        createdAt: 1000,
      });
    });

    // When
    await handler(createTask());

    // Then
    expect(openApp).toHaveBeenCalledWith('aido://todo/12');
  });

  it('이미 열린 앱은 저장된 명령만 소비하고 생성 링크를 중복 열지 않는다', async () => {
    // Given
    const { handler, navigationRepository, openApp } = createHandler(true);

    // When
    await handler(
      createTask({
        clickActionData: {
          uri: 'aido-dev://feed?date=today&action=add-todo',
          userId: 'widget-owner',
        },
      }),
    );

    // Then
    expect(navigationRepository.getPendingCommand()?.uri).toBe(
      'aido-dev://feed?date=today&action=add-todo',
    );
    expect(openApp).not.toHaveBeenCalled();
  });

  it.each(['https://example.com', 'aido://todo/0', 'aido://feed?date=today&date=2026-10-05'])(
    '허용되지 않은 링크 %s는 저장하거나 열지 않는다',
    async (uri) => {
      // Given
      const { handler, navigationRepository, openApp } = createHandler();

      // When
      await handler(createTask({ clickActionData: { uri, userId: 'widget-owner' } }));

      // Then
      expect(navigationRepository.getPendingCommand()).toBeNull();
      expect(openApp).not.toHaveBeenCalled();
    },
  );

  it('소유자를 알 수 없는 예전 위젯에서는 개인 할 일 링크를 열지 않는다', async () => {
    // Given
    const { handler, openApp } = createHandler();

    // When
    await handler(createTask({ clickActionData: { uri: 'aido://todo/12' } }));

    // Then
    expect(openApp).not.toHaveBeenCalled();
  });

  it('로그아웃 안내 위젯은 계정 없이 앱 시작 화면을 열 수 있다', async () => {
    // Given
    const { handler, navigationRepository, openApp } = createHandler();

    // When
    await handler(createTask({ clickActionData: { uri: 'aido-dev://feed?date=today' } }));

    // Then
    expect(openApp).toHaveBeenCalledWith('aido-dev://feed?date=today');
    expect(navigationRepository.getPendingCommand()).toBeNull();
  });

  it('렌더 요청은 저장된 스냅샷을 사용하고 삭제된 위젯은 갱신하지 않는다', async () => {
    // Given
    const { handler } = createHandler();
    const task = createTask({ widgetAction: 'WIDGET_UPDATE' });

    // When
    await handler(task);
    await handler({ ...task, widgetAction: 'WIDGET_DELETED' });

    // Then
    expect(renderStoredAndroidWidget).toHaveBeenCalledTimes(1);
    expect(task.renderWidget).toHaveBeenCalledTimes(1);
  });

  it('앱 열기와 오류 관측이 함께 실패해도 headless 작업을 크래시시키지 않는다', async () => {
    // Given
    const { handler, openApp, errorReporter } = createHandler();
    openApp.mockRejectedValue(new Error('activity unavailable'));
    errorReporter.captureException.mockImplementation(() => {
      throw new Error('report failed');
    });

    // When / Then
    await expect(handler(createTask())).resolves.toBeUndefined();
    expect(errorReporter.captureException).toHaveBeenCalledWith(expect.any(Error), {
      feature: 'widget',
      method: 'handleWidgetTask',
    });
  });
});
