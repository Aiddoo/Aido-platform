import type { InstallReferrerGateway } from '@src/core/ports/install-referrer';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

// Play 설치 referrer만 있다. iOS는 웹에서 코드를 보여 주고 직접 입력하게 한다
export const expoInstallReferrerGateway: InstallReferrerGateway = {
  read() {
    if (Platform.OS !== 'android') {
      return Promise.resolve(null);
    }

    return Application.getInstallReferrerAsync();
  },
};
