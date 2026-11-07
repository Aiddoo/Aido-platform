import * as Sentry from '@sentry/react-native';
import { ENV } from '@src/shared/config/env';
import { registerWidgetTaskHandler as registerNativeWidgetTaskHandler } from 'react-native-android-widget';
import type { WidgetTaskHandler, WidgetTaskHandlerProps } from 'react-native-android-widget';

import { registerWidgetTaskHandler } from './register-widget-task-handler.android';

let mockSentryClient: object | undefined;

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(() => {
    mockSentryClient = {};
  }),
  getClient: jest.fn(() => mockSentryClient),
  mobileReplayIntegration: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
}));

function createFailingRenderTask(): WidgetTaskHandlerProps {
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
    widgetAction: 'WIDGET_UPDATE',
    renderWidget: () => {
      throw new Error('widget render failed');
    },
  };
}

describe('registerWidgetTaskHandler', () => {
  beforeEach(() => {
    mockSentryClient = undefined;
  });

  it('앱 화면 없이 위젯만 깨어난 프로세스의 오류도 운영에서는 Sentry로 보고한다', async () => {
    // Given
    jest.replaceProperty(ENV, 'IS_PRODUCTION', true);
    let handler: WidgetTaskHandler | undefined;
    jest.mocked(registerNativeWidgetTaskHandler).mockImplementation((registered) => {
      handler = registered;
    });
    registerWidgetTaskHandler();

    // When
    await handler?.(createFailingRenderTask());

    // Then
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'widget render failed' }),
      expect.objectContaining({ tags: expect.objectContaining({ feature: 'widget' }) }),
    );
  });

  it('위젯만 깨어난 프로세스에서도 오류 보고기를 초기화한다', () => {
    // Given
    jest.replaceProperty(ENV, 'IS_PRODUCTION', true);

    // When
    registerWidgetTaskHandler();

    // Then
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });

  it('앱 루트가 이미 초기화한 프로세스에서는 다시 초기화하지 않는다', () => {
    // Given
    jest.replaceProperty(ENV, 'IS_PRODUCTION', true);
    mockSentryClient = {};

    // When
    registerWidgetTaskHandler();

    // Then
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
