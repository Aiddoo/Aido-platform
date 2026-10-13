import { Platform } from 'react-native';

export const STORE_URLS = {
  SUBSCRIPTION_MANAGEMENT: Platform.select({
    ios: 'https://apps.apple.com/account/subscriptions',
    android: 'https://play.google.com/store/account/subscriptions',
    default: '',
  }),
} as const;
