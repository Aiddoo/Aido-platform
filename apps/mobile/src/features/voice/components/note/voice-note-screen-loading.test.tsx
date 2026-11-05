import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { VoiceNoteScreenLoading } from './voice-note-screen-loading';

describe('VoiceNoteScreenLoading', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    jest.clearAllMocks();
  });

  test('연결이 있으면 안내 없이 기다린다', async () => {
    // Given
    onlineManager.setOnline(true);

    // When
    await renderUi(<VoiceNoteScreenLoading />);

    // Then
    expect(screen.queryByTestId('voice-note-screen-offline')).toBeNull();
  });

  test('오프라인이면 연결되면 이어진다고 안내하고 닫을 수 있게 한다', async () => {
    // Given
    onlineManager.setOnline(false);
    await renderUi(<VoiceNoteScreenLoading />);
    expect(screen.getByText('인터넷에 연결되면 이어서 할 수 있어요')).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByText('닫기'));

    // Then
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
