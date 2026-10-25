import type { SystemShareGateway } from '@src/core/ports/system-share';
import { Platform, Share } from 'react-native';

export const rnSystemShareGateway: SystemShareGateway = {
  async share({ message, url, dialogTitle }) {
    // iOS는 url을 따로 받아 미리보기를 만들고, Android는 url을 무시해서 본문 다음 줄에 붙인다
    const result = await Share.share(
      Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` },
      { dialogTitle },
    );
    return result.action === Share.sharedAction;
  },
};
