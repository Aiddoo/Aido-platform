import type { NativeApplicationMetadataGateway } from '@src/core/ports/native-application-metadata';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const expoApplicationMetadataGateway: NativeApplicationMetadataGateway = {
  getInstallation() {
    if (Constants.expoVersion !== null || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
      return undefined;
    }
    return {
      platform: Platform.OS,
      currentVersion: Application.nativeApplicationVersion ?? undefined,
    };
  },
};
