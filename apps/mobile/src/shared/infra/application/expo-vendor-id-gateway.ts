import type { VendorIdGateway } from '@src/core/ports/vendor-id-gateway';
import * as Application from 'expo-application';

export const expoVendorIdGateway: VendorIdGateway = {
  get: async () => {
    if (process.env.EXPO_OS === 'ios') {
      return Application.getIosIdForVendorAsync();
    }
    if (process.env.EXPO_OS === 'android') {
      return Application.getAndroidId();
    }
    return null;
  },
};
