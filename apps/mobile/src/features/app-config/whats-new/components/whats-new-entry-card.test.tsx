import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { WhatsNewEntryCard } from './whats-new-entry-card';

describe('WhatsNewEntryCard', () => {
  it('제목과 다시 볼 수 있는 기간을 보여 준다', async () => {
    // When
    await renderUi(<WhatsNewEntryCard onPress={jest.fn()} onClose={jest.fn()} />);

    // Then
    expect(screen.getByText('새로운 기능을 만나보세요')).toBeTruthy();
    expect(screen.getByText('14일 동안 여기서 다시 볼 수 있어요')).toBeTruthy();
  });

  it('카드를 누르면 열고 닫기를 눌러도 열지 않는다', async () => {
    // Given
    const onPress = jest.fn();
    const onClose = jest.fn();
    await renderUi(<WhatsNewEntryCard onPress={onPress} onClose={onClose} />);

    // When
    await fireEvent.press(screen.getByLabelText('새로운 기능 카드 닫기'));

    // Then
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    // When
    await fireEvent.press(screen.getByLabelText('새로운 기능 열기'));

    // Then
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
