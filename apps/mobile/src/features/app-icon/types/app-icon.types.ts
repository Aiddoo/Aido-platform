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
  label: string;
  preview: ImageSourcePropType;
}
