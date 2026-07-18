import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { buttonVariants } from './Button.variants';

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

describe('Button', () => {
  test('children을 렌더링한다', async () => {
    await render(<Button>버튼</Button>);

    expect(screen.getByText('버튼')).toBeTruthy();
  });

  test('isLoading일 때 Spinner를 표시하고 children을 숨긴다', async () => {
    await render(<Button isLoading>로딩</Button>);

    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.queryByText('로딩')).toBeNull();
  });

  test('isDisabled와 isLoading 모두 버튼을 비활성화한다', async () => {
    const { rerender } = await render(
      <Button testID="button" isDisabled>
        버튼
      </Button>,
    );
    expect(screen.getByTestId('button').props.isDisabled).toBe(true);

    await rerender(
      <Button testID="button" isLoading>
        버튼
      </Button>,
    );
    expect(screen.getByTestId('button').props.isDisabled).toBe(true);
  });
});

describe('buttonVariants', () => {
  test('fill variant는 solid 배경색, weak는 투명도 있는 배경색을 적용한다', () => {
    expect(buttonVariants({ variant: 'fill', color: 'primary' })).toContain('bg-main');
    expect(buttonVariants({ variant: 'weak', color: 'primary' })).toContain('bg-main/5');
  });

  test('size에 따라 높이가 달라진다', () => {
    expect(buttonVariants({ size: 'small' })).toContain('h-8');
    expect(buttonVariants({ size: 'xlarge' })).toContain('h-14');
  });

  test('비활성화 상태에서는 뮤트된 배경색으로 전환된다', () => {
    const primaryDisabled = buttonVariants({ variant: 'fill', color: 'primary', isDisabled: true });
    const darkDisabled = buttonVariants({ variant: 'fill', color: 'dark', isDisabled: true });

    expect(primaryDisabled).not.toContain('opacity-40');
    expect(primaryDisabled).toContain('bg-gray-5');
    expect(darkDisabled).toContain('bg-gray-7');
  });
});
