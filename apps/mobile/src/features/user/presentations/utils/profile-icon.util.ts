import defaultProfileIconImage from '@assets/images/icon.png';
import { APP_ICONS } from '@src/features/app-icon/constants/app-icons.constant';
import type { ImageSourcePropType } from 'react-native';

const ICON_MAP = new Map<string, ImageSourcePropType>(
  APP_ICONS.map((icon) => [icon.key, icon.preview]),
);

const DEFAULT_ICON: ImageSourcePropType = defaultProfileIconImage;

/** profileImage 값(아이콘 키 | URL | null)을 Image source로 변환 */
export const getProfileIconSource = (profileImage: string | null): ImageSourcePropType => {
  if (!profileImage) return DEFAULT_ICON;

  const localIcon = ICON_MAP.get(profileImage);
  if (localIcon) return localIcon;

  return { uri: profileImage };
};
