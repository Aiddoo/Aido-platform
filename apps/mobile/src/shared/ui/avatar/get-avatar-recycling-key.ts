import type { ImageSourcePropType } from 'react-native';

// FlashList이 셀을 재활용할 때 이전 사람의 이미지가 잠깐 보이지 않도록 소스마다 고유한 키를 만든다
export function getAvatarRecyclingKey(source: ImageSourcePropType): string | undefined {
  if (typeof source === 'number') {
    return String(source);
  }
  if ('length' in source) {
    return source[0]?.uri ?? undefined;
  }
  return source.uri ?? undefined;
}
