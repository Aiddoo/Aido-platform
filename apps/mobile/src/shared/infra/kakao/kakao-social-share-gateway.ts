import { initializeKakaoSDK } from '@react-native-kakao/core';
import { shareFeedTemplate } from '@react-native-kakao/share';
import type { SocialShareGateway } from '@src/core/ports/social-share-gateway';

/** 처음 공유할 때만 초기화해 앱 시작 시간에 영향을 주지 않는다 */
export function createKakaoSocialShareGateway(
  nativeAppKey: string | undefined,
): SocialShareGateway {
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
    shareFeed: async (feed) => {
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
                iosExecutionParams: feed.appLinkParams,
                androidExecutionParams: feed.appLinkParams,
              },
            },
          ],
        },
      });
    },
  };
}
