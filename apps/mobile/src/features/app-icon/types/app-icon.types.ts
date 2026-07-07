import type { ImageSourcePropType } from 'react-native';

export type AppIconKey =
  | 'default'
  | 'scottish_fold'
  | 'orange_tabby'
  | 'black_cat'
  | 'white_cat'
  | 'siamese';

export interface AppIconItem {
  key: AppIconKey;
  /** appIcon 네임스페이스의 아이콘 라벨 키 (예: 'icons.default') */
  labelKey: string;
  preview: ImageSourcePropType;
}
