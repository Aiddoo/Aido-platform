import { initializeKakaoSDK } from '@react-native-kakao/core';
import { shareFeedTemplate } from '@react-native-kakao/share';
import type { KakaoShareGateway } from '@src/core/ports/kakao-share';

/**
 * 카카오 SDK는 처음 공유할 때만 초기화한다(앱 시작 시간에 영향을 주지 않는다).
 * 카카오톡이 없으면 SDK가 웹 공유로 연다.
 */
export function createKakaoShareClient(nativeAppKey: string | undefined): KakaoShareGateway {
  let initialization: Promise<void> | null = null;

  const initialize = (appKey: string) => {
    initialization ??= initializeKakaoSDK(appKey).catch((error: unknown) => {
      // 실패한 초기화는 다음 공유에서 다시 시도한다
      initialization = null;
      throw error;
    });
    return initialization;
  };

  return {
    isAvailable: () => nativeAppKey != null && nativeAppKey !== '',
    async shareFeed(feed) {
      if (nativeAppKey == null || nativeAppKey === '') {
        throw new Error('[KakaoShare] native app key is not configured');
      }

      await initialize(nativeAppKey);
      await shareFeedTemplate({
        template: {
          content: {
            title: feed.title,
            description: feed.description,
            imageUrl: feed.imageUrl,
            imageWidth: feed.imageWidth,
            imageHeight: feed.imageHeight,
            link: { webUrl: feed.webUrl, mobileWebUrl: feed.webUrl },
          },
          buttons: [
            {
              title: feed.buttonTitle,
              link: {
                webUrl: feed.webUrl,
                mobileWebUrl: feed.webUrl,
                iosExecutionParams: feed.executionParams,
                androidExecutionParams: feed.executionParams,
              },
            },
          ],
        },
      });
    },
  };
}
