import defaultProfileIconImage from '@assets/images/profile-icons/default.webp';
import { APP_ICONS } from '@src/features/device/app-icon/constants/app-icon.constants';
import { keyBy } from 'es-toolkit';
import type { ImageSourcePropType } from 'react-native';

const ICONS_BY_KEY: Readonly<Record<string, { preview: ImageSourcePropType }>> = keyBy(
  APP_ICONS,
  (icon) => icon.key,
);

const DEFAULT_ICON: ImageSourcePropType = defaultProfileIconImage;

/** profileImage 값(아이콘 키 | URL | null)을 Image source로 변환 */
export function getProfileIconSource(profileImage: string | null): ImageSourcePropType {
  if (profileImage == null) {
    return DEFAULT_ICON;
  }

  const localIcon = ICONS_BY_KEY[profileImage];
  if (localIcon != null) {
    return localIcon.preview;
  }

  // 빈 문자열도 URL이 아니라 기본 아이콘이다
  return /^https?:\/\//i.test(profileImage) ? { uri: profileImage } : DEFAULT_ICON;
}
