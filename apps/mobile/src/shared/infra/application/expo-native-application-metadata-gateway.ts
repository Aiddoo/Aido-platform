import type { NativeApplicationMetadataGateway } from '@src/core/ports/native-application-metadata-gateway';
import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export const expoNativeApplicationMetadataGateway: NativeApplicationMetadataGateway = {
  getInstallation: () => {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return null;
    }
    return {
      platform: process.env.EXPO_OS ?? null,
      currentVersion: Application.nativeApplicationVersion,
      currentBuild: Application.nativeBuildVersion,
      applicationId: Application.applicationId,
    };
  },
};
