import type { ExternalLinkGateway } from '@src/core/ports/external-link-gateway';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

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
};
