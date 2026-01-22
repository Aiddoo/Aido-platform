import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Result } from './Result';

jest.mock('heroui-native', () => {
  const { View } = require('react-native');
  return {
    PressableFeedback: Object.assign(
      ({ children, ...props }: { children: ReactNode }) => <View {...props}>{children}</View>,
      { Highlight: () => null },
    ),
    Spinner: () => <View testID="spinner" />,
  };
});

describe('Result', () => {
  test('title을 렌더링한다', () => {
    render(<Result title="테스트 제목" />);

    expect(screen.getByText('테스트 제목')).toBeTruthy();
  });

  test('description을 렌더링한다', () => {
    render(<Result title="제목" description="상세 설명입니다" />);

    expect(screen.getByText('상세 설명입니다')).toBeTruthy();
  });

  test('icon을 렌더링한다', () => {
    render(<Result title="제목" icon={<View testID="custom-icon" />} />);

    expect(screen.getByTestId('custom-icon')).toBeTruthy();
  });

  test('button을 렌더링하고 클릭 시 onPress를 호출한다', () => {
    const onPress = jest.fn();
    render(<Result title="제목" button={<Result.Button onPress={onPress}>확인</Result.Button>} />);

    const button = screen.getByText('확인');
    expect(button).toBeTruthy();

    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('button이 없으면 버튼을 렌더링하지 않는다', () => {
    render(<Result title="제목" />);

    expect(screen.queryByText('확인')).toBeNull();
  });
});

describe('Result.Button', () => {
  test('children을 렌더링한다', () => {
    render(<Result.Button>버튼 텍스트</Result.Button>);

    expect(screen.getByText('버튼 텍스트')).toBeTruthy();
  });
});
