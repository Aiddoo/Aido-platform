import { createMemoryObservableSyncStorage } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import type { WidgetInfo } from 'react-native-android-widget';

import { AndroidWidgetService } from './android-widget.service';

const widgetInfo = {
  widgetName: 'AidoTodayList',
  widgetId: 1,
  width: 320,
  height: 160,
  screenInfo: {
    screenWidthDp: 411,
    screenHeightDp: 915,
    density: 2.6,
    densityDpi: 420,
    fontScale: 1,
  },
} satisfies WidgetInfo;

describe('AndroidWidgetService', () => {
  describe('renderStoredWidget', () => {
    it.each([
      ['ko', '로그인이 필요해요', '앱을 열어 시작하기'],
      ['en', 'Sign in to get started', 'Tap to sign in'],
      ['ja', 'Sign in to get started', 'Tap to sign in'],
      [null, 'Sign in to get started', 'Tap to sign in'],
    ])(
      '첫 동기화 전 기기 언어 %s에서는 로그인 안내를 그 언어(ko 외 en)로 표시한다',
      (language, title, cta) => {
        // Given
        const renderWidget = jest.fn();
        const service = new AndroidWidgetService({
          widgetStorage: createMemoryObservableSyncStorage(),
          readLocalDateKey: () => createDateKey('2026-11-07'),
          readDeviceLanguage: () => language,
          readAppScheme: () => 'aido-dev',
          renderWidget,
        });

        // When
        service.renderStoredWidget(widgetInfo);

        // Then
        expect(renderWidget).toHaveBeenLastCalledWith(
          expect.objectContaining({
            state: 'loggedOut',
            stateTitle: title,
            stateCta: cta,
            openAppUrl: 'aido-dev://feed?date=today',
          }),
          widgetInfo,
          null,
        );
      },
    );
  });
});
