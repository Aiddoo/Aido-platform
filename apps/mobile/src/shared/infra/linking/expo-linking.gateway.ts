import type { ExternalLinkGateway, IncomingLinkGateway } from '@src/core/ports/external-link';
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

export const expoIncomingLinkGateway: IncomingLinkGateway = {
  getInitialUrl: () => Linking.getInitialURL(),
  subscribe: (listener) => {
    const subscription = Linking.addEventListener('url', listener);
    return () => subscription.remove();
  },
};
