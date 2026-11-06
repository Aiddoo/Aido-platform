import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { Steps } from './steps';

jest.mock('heroui-native', () => {
  const { Pressable } = require('react-native');
  return {
    PressableFeedback: ({ children, ...props }: { children: ReactNode }) => (
      <Pressable {...props}>{children}</Pressable>
    ),
  };
});

jest.mock('uniwind', () => ({ useResolveClassNames: () => ({ backgroundColor: '#ffffff' }) }));

jest.mock('../icon/icons', () => ({ FillCheckIcon: () => null }));

jest.mock('@src/shared/hooks/use-reduce-motion', () => ({ useReduceMotion: () => false }));

async function renderButtons(props: { index: number; isLast: boolean }) {
  const onBack = jest.fn();
  const onNext = jest.fn();
  await render(
    <Steps.Buttons {...props} backLabel="이전" nextLabel="다음" onBack={onBack} onNext={onNext} />,
  );
  return { onBack, onNext };
}

describe('Steps.Buttons', () => {
  it('다음 버튼을 누르면 onNext를 부른다', async () => {
    // Given
    const { onNext } = await renderButtons({ index: 0, isLast: false });

    // When
    await fireEvent.press(screen.getByText('다음'));

    // Then
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('첫 단계에서는 뒤로 버튼을 접근성 트리에서 숨긴다', async () => {
    // Given
    await renderButtons({ index: 0, isLast: false });

    // Then
    expect(screen.queryByText('이전')).toBeNull();
    expect(screen.getByText('이전', { includeHiddenElements: true })).toBeTruthy();
  });

  it('둘째 단계부터 뒤로 버튼을 눌러 onBack을 부른다', async () => {
    // Given
    const { onBack } = await renderButtons({ index: 1, isLast: false });

    // When
    await fireEvent.press(screen.getByText('이전'));

    // Then
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
