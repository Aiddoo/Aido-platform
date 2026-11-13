import type { SystemShareGateway } from '@src/core/ports/system-share-gateway';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

export const expoSystemShareGateway: SystemShareGateway = {
  share: async ({ message, url, dialogTitle }) => {
    // iOS는 url을 따로 받아 미리보기를 만들고, Android는 url을 무시해서 본문 다음 줄에 붙인다
    const result = await Share.share(
      process.env.EXPO_OS === 'ios' ? { message, url } : { message: `${message}\n${url}` },
      { dialogTitle },
    );
    // Android Share.share는 공유 시트를 그냥 닫아도 sharedAction으로 끝난다. 그래서 Android의 true는
    // "공유 시트를 열었다"까지만 뜻하고, 실제로 보냈는지는 iOS 값만 믿을 수 있다
    return result.action === Share.sharedAction;
  },
  isImageShareAvailable: () => Sharing.isAvailableAsync(),
  shareImage: (fileUri) =>
    Sharing.shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png' }),
};
