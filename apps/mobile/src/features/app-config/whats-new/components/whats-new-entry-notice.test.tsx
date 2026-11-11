import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { WhatsNewEntryNotice } from './whats-new-entry-notice';

describe('WhatsNewEntryNotice', () => {
  it('카드를 누르면 열고 닫기를 눌러도 열지 않는다', async () => {
    // Given
    const onPress = jest.fn();
    const onClose = jest.fn();
    await renderScreen(<WhatsNewEntryNotice onPress={onPress} onClose={onClose} />);

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
