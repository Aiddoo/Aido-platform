import type { InstallationIdGateway } from '@src/core/ports/installation-id';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

export const expoInstallationIdGateway: InstallationIdGateway = {
  async get() {
    if (Platform.OS === 'ios') {
      return Application.getIosIdForVendorAsync();
    }
    if (Platform.OS === 'android') {
      return Application.getAndroidId();
    }

    return null;
  },
};
