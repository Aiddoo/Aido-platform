import type { AppIconItem } from '../types/app-icon.types';

export const APP_ICONS: AppIconItem[] = [
  { key: 'default', label: '기본', preview: require('@assets/premium-app-icons/default.png') },
  {
    key: 'scottish_fold',
    label: '스코티시폴드',
    preview: require('@assets/premium-app-icons/scottish-fold.png'),
  },
  {
    key: 'orange_tabby',
    label: '치즈 태비',
    preview: require('@assets/premium-app-icons/orange-tabby.png'),
  },
  {
    key: 'black_cat',
    label: '검은 고양이',
    preview: require('@assets/premium-app-icons/black-cat.png'),
  },
  {
    key: 'white_cat',
    label: '하얀 고양이',
    preview: require('@assets/premium-app-icons/white-cat.png'),
  },
  { key: 'siamese', label: '샴', preview: require('@assets/premium-app-icons/siamese.png') },
];
