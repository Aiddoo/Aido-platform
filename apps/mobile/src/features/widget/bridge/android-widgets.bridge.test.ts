import { getDeviceLanguage } from '@src/shared/i18n/device-language';
import type { WidgetInfo } from 'react-native-android-widget';

import { renderAndroidWidget } from '../components/widgets.android';
import { renderStoredAndroidWidget } from './android-widgets.bridge';

jest.mock('@src/shared/infra/storage/widget-navigation-storage', () => ({
  widgetNavigationStorage: {
    getString: () => undefined,
    set: jest.fn(),
    delete: jest.fn(),
    subscribe: () => jest.fn(),
  },
}));
jest.mock('@src/shared/i18n/device-language', () => ({ getDeviceLanguage: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { scheme: 'aido-dev' } }));
jest.mock('react-native-android-widget', () => ({ requestWidgetUpdate: jest.fn() }));
jest.mock('../components/widgets.android', () => ({ renderAndroidWidget: jest.fn() }));

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

describe('Android 위젯 첫 동기화 전 렌더링', () => {
  it.each([
    ['ko', '로그인이 필요해요', '앱을 열어 시작하기'],
    ['en', 'Sign in to get started', 'Tap to sign in'],
    ['ja', 'Sign in to get started', 'Tap to sign in'],
    [null, 'Sign in to get started', 'Tap to sign in'],
  ])('기기 언어 %s에서는 로그인 안내를 그 언어(ko 외 en)로 표시한다', (language, title, cta) => {
    // Given
    jest.mocked(getDeviceLanguage).mockReturnValue(language);

    // When
    renderStoredAndroidWidget(widgetInfo);

    // Then
    expect(renderAndroidWidget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: 'loggedOut',
        stateTitle: title,
        stateCta: cta,
        openAppUrl: 'aido-dev://feed?date=today',
      }),
      widgetInfo,
      null,
    );
  });
});
