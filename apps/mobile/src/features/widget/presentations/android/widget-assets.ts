import type { ImageRequireSource } from 'react-native';

import type { WidgetBadgeTier } from '../../models/widget-snapshot.model';

/** 위젯에서 쓰는 폰트 패밀리 — app.config.ts의 react-native-android-widget fonts와 일치 */
export const WIDGET_FONTS = {
  regular: 'WantedSans-Regular',
  medium: 'WantedSans-Medium',
  semibold: 'WantedSans-SemiBold',
  bold: 'WantedSans-Bold',
} as const;

/** 진행 티어별 고양이 배지 + 상태 화면 마스코트 (achievement 자산 재사용) */
export const WIDGET_BADGE_IMAGES: Record<WidgetBadgeTier | 'mascot', ImageRequireSource> = {
  empty: require('@assets/images/badge_empty.webp'),
  almost: require('@assets/images/badge_almost.webp'),
  completed: require('@assets/images/badge_completed.webp'),
  perfect: require('@assets/images/badge_perfect.webp'),
  mascot: require('@assets/images/ido_cat_hi.webp'),
};
