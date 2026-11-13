import { captureException, init } from '@sentry/react-native';
import { ENV } from '@src/shared/config/env';
import { resetSentryClient } from '@src/testing/mocks/sentry-react-native';
import { registerWidgetTaskHandler as registerNativeWidgetTaskHandler } from 'react-native-android-widget';
import type { WidgetTaskHandler, WidgetTaskHandlerProps } from 'react-native-android-widget';

import { registerWidgetTaskHandler } from './register-widget-task-handler.android';

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
    resetSentryClient();
  });

  it('앱 화면 없이 위젯만 깨어난 프로세스는 오류를 Sentry로 보내지 않고 작업을 끝낸다', async () => {
    // Given
    jest.replaceProperty(ENV, 'IS_PRODUCTION', true);
    let handler: WidgetTaskHandler | undefined;
    jest.mocked(registerNativeWidgetTaskHandler).mockImplementation((registered) => {
      handler = registered;
    });
    registerWidgetTaskHandler();

    // When
    const result = handler?.(createFailingRenderTask());

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });
});
