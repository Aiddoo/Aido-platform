import { PROFILE_ICON_KEYS } from '@aido/validators';
import black_cat from '@assets/premium-app-icons/black-cat.png';
import cream_cat from '@assets/premium-app-icons/cream-cat.png';
import defaultIcon from '@assets/premium-app-icons/default.png';
import orange_tabby from '@assets/premium-app-icons/orange-tabby.png';
import russian_blue from '@assets/premium-app-icons/russian-blue.png';
import scottish_fold from '@assets/premium-app-icons/scottish-fold.png';
import siamese from '@assets/premium-app-icons/siamese.png';
import tuxedo_cat from '@assets/premium-app-icons/tuxedo-cat.png';
import white_cat from '@assets/premium-app-icons/white-cat.png';
import type { ImageSourcePropType } from 'react-native';

import type { AppIconKey } from '../../models/app-icon.model';

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
