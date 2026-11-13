import { toInstant } from '@src/shared/date/instant';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import { createMemoryObservableSyncStorage } from '@src/testing/core';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { ANDROID_WIDGET_NAVIGATION_ACTION } from '../constants/widget.constants';
import { createWidgetNavigationRepository } from '../repositories/widget-navigation.repository';
import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';
import { createAndroidWidgetTaskHandler } from './android-widget-task-handler';

const TAPPED_AT = toInstant('2026-11-05T00:00:00.000Z');

function createHandler(isAppActive = false) {
  const storage = createMemoryObservableSyncStorage();
  const navigationRepository = createWidgetNavigationRepository(storage);
  const openApp = jest.fn(async () => {});
  const renderStoredWidget = jest.fn();
  return {
    navigationRepository,
    openApp,
    storage,
    renderStoredWidget,
    handler: createAndroidWidgetTaskHandler({
      navigationRepository,
      openApp,
      isAppActive: () => isAppActive,
      now: () => TAPPED_AT,
      createCommandId: () => 'widget-tap',
      failureStorage: storage,
      renderStoredWidget,
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
      screenInfo: {
        screenHeightDp: 800,
        screenWidthDp: 400,
        density: 2,
        densityDpi: 320,
        fontScale: 1,
      },
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
      expect(navigationRepository.findPendingCommand()).toEqual({
        id: 'widget-tap',
        uri: 'aido://todo/12',
        userId: 'widget-owner',
        createdAt: TAPPED_AT,
      });
    });

    // When
    await handler(createTask());

    // Then
    expect(openApp).toHaveBeenCalledWith('aido://feed?date=today');
  });

  it.each([
    ['aido://todo/12', 'aido://feed?date=today'],
    ['aido-dev://feed?date=today&action=add-todo', 'aido-dev://feed?date=today'],
    ['aido-preview://feed?date=2026-10-05', 'aido-preview://feed?date=today'],
  ])('이전 계정의 %s 클릭도 인증 가드 전에는 일반 홈만 연다', async (uri, wakeUri) => {
    // Given
    const { handler, navigationRepository, openApp } = createHandler();

    // When
    await handler(createTask({ clickActionData: { uri, userId: 'previous-widget-owner' } }));

    // Then
    expect(openApp).toHaveBeenCalledWith(wakeUri);
    expect(navigationRepository.findPendingCommand()?.uri).toBe(uri);
    expect(navigationRepository.findPendingCommand()?.userId).toBe('previous-widget-owner');
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
    expect(navigationRepository.findPendingCommand()?.uri).toBe(
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
      expect(navigationRepository.findPendingCommand()).toBeNull();
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
    expect(navigationRepository.findPendingCommand()).toBeNull();
  });

  it('렌더 요청은 저장된 스냅샷을 사용하고 삭제된 위젯은 갱신하지 않는다', async () => {
    // Given
    const { handler, renderStoredWidget } = createHandler();
    const task = createTask({ widgetAction: 'WIDGET_UPDATE' });

    // When
    await handler(task);
    await handler({ ...task, widgetAction: 'WIDGET_DELETED' });

    // Then
    expect(renderStoredWidget).toHaveBeenCalledTimes(1);
    expect(task.renderWidget).toHaveBeenCalledTimes(1);
  });

  it('앱 열기가 실패하면 작업을 크래시시키지 않고 실패를 저장소에 남긴다', async () => {
    // Given
    const { handler, openApp, storage } = createHandler();
    openApp.mockRejectedValue(new Error('activity unavailable'));

    // When
    const result = handler(createTask());

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(readStoredValue(storage, widgetHeadlessFailureStoredValue)).toEqual({
      method: 'handleWidgetTask',
      name: 'Error',
      message: 'activity unavailable',
    });
  });
});
