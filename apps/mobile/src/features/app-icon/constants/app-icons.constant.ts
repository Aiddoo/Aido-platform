import blackCatAppIcon from '@assets/premium-app-icons/black-cat.png';
import defaultAppIcon from '@assets/premium-app-icons/default.png';
import orangeTabbyAppIcon from '@assets/premium-app-icons/orange-tabby.png';
import scottishFoldAppIcon from '@assets/premium-app-icons/scottish-fold.png';
import siameseAppIcon from '@assets/premium-app-icons/siamese.png';
import whiteCatAppIcon from '@assets/premium-app-icons/white-cat.png';
import { tDynamic } from '@src/shared/i18n';

import type { AppIconItem } from '../types/app-icon.types';

export const APP_ICONS: AppIconItem[] = [
  { key: 'default', labelKey: 'icons.default', preview: defaultAppIcon },
  {
    key: 'scottish_fold',
    labelKey: 'icons.scottishFold',
    preview: scottishFoldAppIcon,
  },
  {
    key: 'orange_tabby',
    labelKey: 'icons.orangeTabby',
    preview: orangeTabbyAppIcon,
  },
  {
    key: 'black_cat',
    labelKey: 'icons.blackCat',
    preview: blackCatAppIcon,
  },
  {
    key: 'white_cat',
    labelKey: 'icons.whiteCat',
    preview: whiteCatAppIcon,
  },
  { key: 'siamese', labelKey: 'icons.siamese', preview: siameseAppIcon },
];

/** 아이콘 라벨을 현재 언어로 반환한다 (렌더 컴포넌트는 useTranslation으로 리렌더 구독 필요) */
export const getAppIconLabel = (icon: AppIconItem): string => tDynamic('appIcon', icon.labelKey);
