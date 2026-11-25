import type { ExternalLinkGateway } from '@src/core/ports/external-link-gateway';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { IS_IOS_APP_ON_MAC } from '../device/device-info';

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
};
