import type { SystemShareGateway } from '@src/core/ports/system-share';
import { Platform, Share } from 'react-native';

export const rnSystemShareGateway: SystemShareGateway = {
  async share({ message, url, dialogTitle }) {
    // iOS는 url을 따로 받아 미리보기를 만들고, Android는 url을 무시해서 본문 다음 줄에 붙인다
    const result = await Share.share(
      Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` },
      { dialogTitle },
    );
    // Android Share.share는 공유 시트를 그냥 닫아도 sharedAction으로 끝난다. 그래서 Android의 true는
    // "공유 시트를 열었다"까지만 뜻하고, 실제로 보냈는지는 iOS 값만 믿을 수 있다
    return result.action === Share.sharedAction;
  },
};
