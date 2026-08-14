import '@src/shared/i18n/init';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { FeatureDiscoveryReentryCard } from './FeatureDiscoveryReentryCard';

jest.mock('@src/shared/ui', () => {
  const React = require('react');
  const { Text: NativeText, View } = require('react-native');
  return {
    RobotPixelIcon: () => null,
    Text: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(NativeText, props, children),
    VStack: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(View, props, children),
  };
});

jest.mock('heroui-native', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  const PressableFeedback = ({
    children,
    onPress,
    ...props
  }: {
    children: React.ReactNode;
    onPress: () => void;
    [key: string]: unknown;
  }) => React.createElement(Pressable, { ...props, onPress }, children);
  PressableFeedback.Highlight = () => null;
  return { PressableFeedback };
});

describe('FeatureDiscoveryReentryCard', () => {
  it('기능 가이드 재진입 문구를 렌더링한다', async () => {
    // When
    await render(<FeatureDiscoveryReentryCard onPress={jest.fn()} />);

    // Then
    expect(screen.getByText('새 기능을 다시 살펴보세요')).toBeTruthy();
    expect(screen.getByText('14일 동안 언제든 기능 가이드를 다시 열 수 있어요')).toBeTruthy();
  });

  it('카드를 누르면 허브를 다시 연다', async () => {
    // Given
    const onPress = jest.fn();
    await render(<FeatureDiscoveryReentryCard onPress={onPress} />);

    // When
    await fireEvent.press(screen.getByLabelText('Aido 기능 가이드 열기'));

    // Then
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
