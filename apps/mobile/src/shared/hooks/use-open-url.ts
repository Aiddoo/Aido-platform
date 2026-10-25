import { useLogger } from '@src/bootstrap/providers/di-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useRef } from 'react';

import { useSingleTap } from './use-single-tap';

/**
 * 약관·공지 같은 웹 문서를 앱 안 브라우저로 연다.
 * 연타와 브라우저가 떠 있는 동안 들어온 호출은 무시한다. iOS는 두 번째 호출이 실패하고 Android는 탭이 두 개 쌓인다.
 * 앱 안 브라우저를 쓸 수 없으면 기본 브라우저로 열고, 그래도 실패하면 기록만 남긴다.
 */
export function useOpenUrl() {
  const logger = useLogger();
  const isBrowserOpenRef = useRef(false);

  return useSingleTap((url: string) => {
    if (isBrowserOpenRef.current) {
      return;
    }
    isBrowserOpenRef.current = true;

    WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    })
      .catch(() => Linking.openURL(url))
      .catch((error) => logger.warn('web-browser.open.failed', { error }))
      .finally(() => {
        isBrowserOpenRef.current = false;
      });
  });
}
