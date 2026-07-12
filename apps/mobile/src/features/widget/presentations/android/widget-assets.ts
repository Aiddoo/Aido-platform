import type { ImageRequireSource } from 'react-native';

/** 위젯에서 쓰는 폰트 패밀리 — app.config.ts의 react-native-android-widget fonts와 일치 */
export const WIDGET_FONTS = {
  regular: 'WantedSans-Regular',
  medium: 'WantedSans-Medium',
  semibold: 'WantedSans-SemiBold',
  bold: 'WantedSans-Bold',
} as const;

/** 상태 화면(empty/loggedOut/stale) 마스코트 */
export const WIDGET_MASCOT_IMAGE: ImageRequireSource = require('@assets/images/ido_cat_hi.webp');
