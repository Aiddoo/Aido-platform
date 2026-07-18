import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SettingNavigation } from './SettingNavigation';

jest.mock('heroui-native', () => {
  const { Pressable } = require('react-native');
  const PressableFeedback = ({
    children,
    onPress,
    ...props
  }: {
    children: ReactNode;
    onPress?: () => void;
  }) => (
    <Pressable onPress={onPress} {...props}>
      {children}
    </Pressable>
  );
  PressableFeedback.Highlight = () => null;
  return { PressableFeedback };
});

jest.mock('../Icon', () => ({
  ArrowRightIcon: () => {
    const { View } = require('react-native');
    return <View testID="arrow-right-icon" />;
  },
}));

describe('SettingNavigation', () => {
  it('children을 렌더링해야 한다', async () => {
    // Given: Section에 자식 요소가 주어졌을 때
    // When: SettingNavigation을 렌더링하면
    await render(
      <SettingNavigation>
        <View testID="child-1" />
        <View testID="child-2" />
      </SettingNavigation>,
    );

    // Then: 모든 자식 요소가 화면에 표시된다
    expect(screen.getByTestId('child-1')).toBeTruthy();
    expect(screen.getByTestId('child-2')).toBeTruthy();
  });
});

describe('SettingNavigation.Item', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('label 텍스트를 렌더링해야 한다', async () => {
    // Given: label이 주어졌을 때
    // When: SettingNavigation.Item을 렌더링하면
    await render(<SettingNavigation.Item label="알림 설정" onPress={mockOnPress} />);

    // Then: label이 화면에 표시된다
    expect(screen.getByText('알림 설정')).toBeTruthy();
  });

  it('클릭 시 onPress를 호출해야 한다', async () => {
    // Given: onPress 핸들러가 주어졌을 때
    await render(<SettingNavigation.Item label="알림 설정" onPress={mockOnPress} />);

    // When: 아이템을 클릭하면
    await fireEvent.press(screen.getByText('알림 설정'));

    // Then: onPress가 호출된다
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('right를 생략하면 기본 ArrowRightIcon을 렌더링해야 한다', async () => {
    // Given: right prop이 없을 때
    // When: SettingNavigation.Item을 렌더링하면
    await render(<SettingNavigation.Item label="알림 설정" onPress={mockOnPress} />);

    // Then: 기본 ArrowRightIcon이 표시된다
    expect(screen.getByTestId('arrow-right-icon')).toBeTruthy();
  });

  it('커스텀 right를 렌더링해야 한다', async () => {
    // Given: 커스텀 right가 주어졌을 때
    // When: SettingNavigation.Item을 렌더링하면
    await render(
      <SettingNavigation.Item
        label="이름 변경"
        onPress={mockOnPress}
        right={<View testID="custom-right" />}
      />,
    );

    // Then: 커스텀 right가 표시되고 기본 아이콘은 없다
    expect(screen.getByTestId('custom-right')).toBeTruthy();
    expect(screen.queryByTestId('arrow-right-icon')).toBeNull();
  });
});
