import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TextButton } from './TextButton';
import { textButtonVariants } from './TextButton.variants';

jest.mock('heroui-native', () => {
  const { View } = require('react-native');
  return {
    PressableFeedback: ({ children, ...props }: { children: ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock('../Icon', () => ({
  ArrowRightIcon: () => {
    const { View } = require('react-native');
    return <View testID="arrow-icon" />;
  },
}));

describe('TextButton', () => {
  test('children을 렌더링한다', () => {
    render(<TextButton>텍스트</TextButton>);

    expect(screen.getByText('텍스트')).toBeTruthy();
  });

  test('variant=arrow일 때만 화살표 아이콘을 표시한다', () => {
    const { rerender } = render(<TextButton variant="arrow">더보기</TextButton>);
    expect(screen.getByTestId('arrow-icon')).toBeTruthy();

    rerender(<TextButton variant="clear">더보기</TextButton>);
    expect(screen.queryByTestId('arrow-icon')).toBeNull();
  });
});

describe('textButtonVariants', () => {
  test('size에 따라 폰트 크기가 달라진다', () => {
    expect(textButtonVariants({ size: 'xsmall' })).toContain('text-e2');
    expect(textButtonVariants({ size: 'xlarge' })).toContain('text-b2');
  });

  test('underline variant는 밑줄을 적용한다', () => {
    expect(textButtonVariants({ variant: 'underline' })).toContain('underline');
  });

  test('비활성화 상태에서는 투명도가 낮아진다', () => {
    expect(textButtonVariants({ isDisabled: true })).toContain('opacity-40');
  });
});
