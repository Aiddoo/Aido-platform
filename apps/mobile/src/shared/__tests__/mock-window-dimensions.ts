import type * as ReactNative from 'react-native';

export function mockWindowDimensions(width: number, height = 800) {
  const reactNative = jest.requireActual<typeof ReactNative>('react-native');

  return jest
    .spyOn(reactNative, 'useWindowDimensions')
    .mockReturnValue({ width, height, scale: 2, fontScale: 1 });
}
