import type { ExternalLinkGateway, SettingsApp } from '@src/core/ports/external-link-gateway';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { IOS_MAJOR_VERSION, IS_IOS_APP_ON_MAC, IS_IPAD } from '../device/device-info';

// iOS 18부터 앱마다의 설정이 설정 > 앱 아래로 옮겨졌다
const IOS_APPS_SETTINGS_MENU_VERSION = 18;

// iPhone Duo는 휴대폰이다. Android는 휴대폰과 태블릿의 설정이 같아 가르지 않는다
function getSettingsAppDevice(): SettingsApp['device'] {
  if (IS_IOS_APP_ON_MAC) {
    return 'desktop';
  }
  return IS_IPAD ? 'tablet' : 'phone';
}

export const expoExternalLinkGateway: ExternalLinkGateway = {
  open: async (url) => {
    await Linking.openURL(url);
  },
  openInAppBrowser: async (url) => {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  },
  openSettings: () => Linking.openSettings(),
  // Mac(Designed for iPad)에서는 iOS 앱 설정 화면이 열리지 않는다
  canOpenSettings: !IS_IOS_APP_ON_MAC,
  settingsApp: {
    device: getSettingsAppDevice(),
    hasAppsMenu: IOS_MAJOR_VERSION != null && IOS_APPS_SETTINGS_MENU_VERSION <= IOS_MAJOR_VERSION,
  },
};
