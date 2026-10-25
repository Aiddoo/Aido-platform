import { PROFILE_ICON_KEYS } from '@aido/api';
import black_cat from '@assets/images/profile-icons/black-cat.webp';
import cream_cat from '@assets/images/profile-icons/cream-cat.webp';
import defaultIcon from '@assets/images/profile-icons/default.webp';
import orange_tabby from '@assets/images/profile-icons/orange-tabby.webp';
import russian_blue from '@assets/images/profile-icons/russian-blue.webp';
import scottish_fold from '@assets/images/profile-icons/scottish-fold.webp';
import siamese from '@assets/images/profile-icons/siamese.webp';
import tuxedo_cat from '@assets/images/profile-icons/tuxedo-cat.webp';
import white_cat from '@assets/images/profile-icons/white-cat.webp';
import type { ImageSourcePropType } from 'react-native';

import type { AppIconKey } from '../domains/app-icon.model';

const ICON_PREVIEWS = {
  default: { labelKey: 'icons.default', preview: defaultIcon },
  scottish_fold: { labelKey: 'icons.scottishFold', preview: scottish_fold },
  orange_tabby: { labelKey: 'icons.orangeTabby', preview: orange_tabby },
  black_cat: { labelKey: 'icons.blackCat', preview: black_cat },
  white_cat: { labelKey: 'icons.whiteCat', preview: white_cat },
  siamese: { labelKey: 'icons.siamese', preview: siamese },
  russian_blue: { labelKey: 'icons.russianBlue', preview: russian_blue },
  cream_cat: { labelKey: 'icons.creamCat', preview: cream_cat },
  tuxedo_cat: { labelKey: 'icons.tuxedoCat', preview: tuxedo_cat },
} as const satisfies Record<AppIconKey, { labelKey: string; preview: ImageSourcePropType }>;

export const APP_ICONS = PROFILE_ICON_KEYS.map((key) => ({ key, ...ICON_PREVIEWS[key] }));
