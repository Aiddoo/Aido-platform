import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { Steps } from './steps';

async function renderButtons(props: { index: number; isLast: boolean }) {
  const onBack = jest.fn();
  const onNext = jest.fn();
  await renderScreen(
    <Steps.Buttons {...props} backLabel="이전" nextLabel="다음" onBack={onBack} onNext={onNext} />,
  );
  return { onBack, onNext };
}

describe('Steps.Buttons', () => {
  it('첫 단계에서는 뒤로 버튼을 접근성 트리에서 숨긴다', async () => {
    // When
    await renderButtons({ index: 0, isLast: false });

    // Then
    expect(screen.queryByText('이전')).toBeNull();
    expect(screen.getByText('이전', { includeHiddenElements: true })).toBeTruthy();
  });

  it('다음 버튼을 연달아 눌러도 onNext를 한 번만 부른다', async () => {
    // Given
    const { onNext } = await renderButtons({ index: 0, isLast: false });

    // When
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.press(screen.getByText('다음'));

    // Then
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
