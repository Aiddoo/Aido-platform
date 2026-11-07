import type * as ReactNative from 'react-native';

export function stubWindowDimensions(width: number, height = 800, fontScale = 1) {
  const reactNative = jest.requireActual<typeof ReactNative>('react-native');

  return jest
    .spyOn(reactNative, 'useWindowDimensions')
    .mockReturnValue({ width, height, scale: 2, fontScale });
}
