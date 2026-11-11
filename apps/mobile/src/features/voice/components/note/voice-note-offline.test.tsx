import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { VoiceNoteOffline } from './voice-note-offline';

describe('VoiceNoteOffline', () => {
  it('캐시 없이 오프라인이면 연결되면 이어진다고 안내하고 닫기로 이전 화면에 돌아간다', async () => {
    // Given
    await renderScreen(<VoiceNoteOffline />);

    // When
    await fireEvent.press(screen.getByText('닫기'));

    // Then
    expect(screen.getByText('인터넷에 연결되면 이어서 할 수 있어요')).toBeOnTheScreen();
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
