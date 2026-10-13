import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';

export const useOpenUrl = () => {
  return useCallback(async (url: string) => {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  }, []);
};
