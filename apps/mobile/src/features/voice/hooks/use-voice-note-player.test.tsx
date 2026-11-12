import { Text } from '@src/shared/ui';
import { createLoggerStub, createTestDi } from '@src/testing/core';
import { getLastAudioPlaylist } from '@src/testing/mocks/expo-audio';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { useVoiceNotePlayback, useVoiceNotePlayer } from './use-voice-note-player';

let logger: ReturnType<typeof createLoggerStub>;

beforeEach(() => {
  logger = createLoggerStub();
});
const PARTS = [
  { uri: 'file:///part-0.wav', startMs: 0 },
  { uri: 'file:///part-1.wav', startMs: 60_000 },
];

function PlayerProbe() {
  const [parts] = useState(PARTS);
  const player = useVoiceNotePlayer({ parts, durationMs: 120_000 });
  const playback = useVoiceNotePlayback(player, (current) => current);

  return (
    <>
      <Pressable
        testID="toggle"
        onPress={() => {
          player.togglePlay().catch(jest.fn());
        }}
      />
      <Pressable
        testID="play-from-second"
        onPress={() => {
          player.playFrom(70_000).catch(jest.fn());
        }}
      />
      <Pressable
        testID="play-from-first"
        onPress={() => {
          player.playFrom(30_000).catch(jest.fn());
        }}
      />
      <Text testID="position">{String(playback.positionMs)}</Text>
      <Text testID="playing">{String(playback.isPlaying)}</Text>
      <Text testID="loaded">{String(playback.isLoaded)}</Text>
    </>
  );
}

const renderPlayer = async () => {
  await renderScreen(<PlayerProbe />, { di: createTestDi({ ports: { logger } }) });
  return getLastAudioPlaylist();
};

const flush = () => act(async () => undefined);

describe('useVoiceNotePlayer', () => {
  it('조각을 순서대로 플레이리스트에 넣고 위치는 노트 시계로 알린다', async () => {
    // Given
    const playlist = await renderPlayer();

    // When
    await act(async () => playlist.emitStatus({ currentIndex: 1, currentTime: 2 }));

    // Then
    expect(playlist.sources).toEqual([{ uri: PARTS[0]?.uri }, { uri: PARTS[1]?.uri }]);
    expect(screen.getByTestId('position')).toHaveTextContent('62000');
  });

  it('종료 이벤트 바로 뒤에 다른 상태가 이어 와도 끝난 것을 놓치지 않고 처음부터 다시 재생한다', async () => {
    // Given
    const playlist = await renderPlayer();

    // When
    await act(async () => {
      playlist.emitStatus({ currentIndex: 1, playing: false, didJustFinish: true });
      playlist.emitStatus({ currentIndex: 1, playing: false, isLoaded: false, currentTime: 0 });
    });

    // Then
    expect(screen.getByTestId('position')).toHaveTextContent('120000');
    expect(screen.getByTestId('loaded')).toHaveTextContent('true');

    // When
    await fireEvent.press(screen.getByTestId('toggle'));
    await act(async () => playlist.emitStatus({ currentIndex: 0, isLoaded: true }));
    await flush();

    // Then
    expect(playlist.skipTo).toHaveBeenCalledWith(0);
    expect(playlist.seekTo).toHaveBeenCalledWith(0);
    expect(playlist.play).toHaveBeenCalledTimes(1);
  });

  it('파일 끝에 멈춰 있으면 종료 이벤트 없이도 처음부터 다시 재생한다', async () => {
    // Given
    const playlist = await renderPlayer();
    await act(async () =>
      playlist.emitStatus({ currentIndex: 1, currentTime: 60, duration: 60, playing: false }),
    );

    // When
    await fireEvent.press(screen.getByTestId('toggle'));

    // Then
    expect(playlist.skipTo).toHaveBeenCalledWith(0);
    expect(playlist.play).not.toHaveBeenCalled();
  });

  it('다른 조각으로 가면 새 조각이 열린 뒤에만 위치를 옮기고 재생한다', async () => {
    // Given
    const playlist = await renderPlayer();

    // When
    await fireEvent.press(screen.getByTestId('play-from-second'));
    await act(async () => playlist.emitStatus({ currentIndex: 0, isLoaded: true }));
    await act(async () => playlist.emitStatus({ currentIndex: 1, isLoaded: false }));
    await flush();

    // Then
    expect(playlist.skipTo).toHaveBeenCalledWith(1);
    expect(playlist.seekTo).not.toHaveBeenCalled();
    expect(playlist.play).not.toHaveBeenCalled();

    // When
    await act(async () => playlist.emitStatus({ currentIndex: 1, isLoaded: true }));
    await flush();

    // Then
    expect(playlist.seekTo).toHaveBeenCalledWith(10);
    expect(playlist.play).toHaveBeenCalledTimes(1);
  });

  it('이벤트가 교체 전 값을 들고 와도 플레이어가 아직 준비 전이면 옮기지 않는다', async () => {
    // Given
    const playlist = await renderPlayer();
    await fireEvent.press(screen.getByTestId('play-from-second'));
    playlist.isLoaded = false;

    // When
    await act(async () => {
      playlist.currentStatus = { ...playlist.currentStatus, currentIndex: 1, isLoaded: true };
      for (const listener of playlist.listeners) {
        listener(playlist.currentStatus);
      }
    });
    await flush();

    // Then
    expect(playlist.seekTo).not.toHaveBeenCalled();
  });

  it('지금 조각 안에서 옮기면 바로 옮겨 재생한다', async () => {
    // Given
    const playlist = await renderPlayer();

    // When
    await fireEvent.press(screen.getByTestId('play-from-first'));
    await flush();

    // Then
    expect(playlist.skipTo).not.toHaveBeenCalled();
    expect(playlist.seekTo).toHaveBeenCalledWith(30);
    expect(playlist.play).toHaveBeenCalledTimes(1);
  });
});
