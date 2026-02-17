import blackCatAppIcon from '@assets/premium-app-icons/black-cat.png';
import defaultAppIcon from '@assets/premium-app-icons/default.png';
import orangeTabbyAppIcon from '@assets/premium-app-icons/orange-tabby.png';
import scottishFoldAppIcon from '@assets/premium-app-icons/scottish-fold.png';
import siameseAppIcon from '@assets/premium-app-icons/siamese.png';
import whiteCatAppIcon from '@assets/premium-app-icons/white-cat.png';
import type { AppIconItem } from '../types/app-icon.types';

export const APP_ICONS: AppIconItem[] = [
  { key: 'default', label: '기본', preview: defaultAppIcon },
  {
    key: 'scottish_fold',
    label: '스코티시폴드',
    preview: scottishFoldAppIcon,
  },
  {
    key: 'orange_tabby',
    label: '치즈 태비',
    preview: orangeTabbyAppIcon,
  },
  {
    key: 'black_cat',
    label: '검은 고양이',
    preview: blackCatAppIcon,
  },
  {
    key: 'white_cat',
    label: '하얀 고양이',
    preview: whiteCatAppIcon,
  },
  { key: 'siamese', label: '샴', preview: siameseAppIcon },
];
