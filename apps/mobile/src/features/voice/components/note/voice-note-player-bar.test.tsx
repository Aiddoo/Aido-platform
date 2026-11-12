import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { VoiceNotePlayer } from '../../hooks/use-voice-note-player';
import type { VoiceNotePlayback } from '../../utils/voice-note-playback.view-model';
import { VoiceNotePlayerBar } from './voice-note-player-bar';

const LEVELS = [0.2, 0.4, 0.6, 0.8];

function createPlayerStub(initial: Partial<VoiceNotePlayback> = {}) {
  const listeners = new Set<() => void>();
  let playback: VoiceNotePlayback = {
    isLoaded: true,
    isPlaying: false,
    positionMs: 0,
    durationMs: 120_000,
    ...initial,
  };
  const player: jest.Mocked<VoiceNotePlayer> = {
    subscribe: jest.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    getPlayback: jest.fn(() => playback),
    togglePlay: jest.fn(() => Promise.resolve()),
    seekTo: jest.fn((_positionMs: number) => Promise.resolve()),
    playFrom: jest.fn((_positionMs: number) => Promise.resolve()),
  };
  const emit = (next: Partial<VoiceNotePlayback>) => {
    playback = { ...playback, ...next };
    listeners.forEach((listener) => listener());
  };
  return { player, emit, getListenerCount: () => listeners.size };
}

async function renderBar(player: VoiceNotePlayer) {
  const view = await renderScreen(
    <VoiceNotePlayerBar player={player} levels={LEVELS} flagIndexes={[1]} isRecordingAvailable />,
  );
  // 칸 계산은 화면 폭을 받은 뒤에 한다
  await fireEvent(screen.getByLabelText('재생 위치'), 'layout', {
    nativeEvent: { layout: { width: 200, height: 32 } },
  });
  return view;
}

describe('VoiceNotePlayerBar', () => {
  it('드래그를 끝낸 위치로 옮긴다', async () => {
    // Given
    const { player } = createPlayerStub();
    await renderBar(player);

    // When
    await act(async () => {
      fireGestureHandler(getByGestureTestId('voice-note-scrubber'), [
        { state: State.BEGAN, x: 50 },
        { state: State.ACTIVE, x: 80 },
        { state: State.END, x: 100 },
      ]);
    });

    // Then
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledWith(60_000);
  });

  it('다른 제스처에 가로채여 끊긴 드래그는 위치를 옮기지 않는다', async () => {
    // Given
    const { player } = createPlayerStub();
    await renderBar(player);

    // When
    await act(async () => {
      fireGestureHandler(getByGestureTestId('voice-note-scrubber'), [
        { state: State.BEGAN, x: 50 },
        { state: State.ACTIVE, x: 80 },
        { state: State.CANCELLED, x: 100 },
      ]);
    });

    // Then
    expect(player.seekTo).not.toHaveBeenCalled();
  });

  it('화면 밖까지 끌어도 노트 범위 안으로 옮긴다', async () => {
    // Given
    const { player } = createPlayerStub();
    await renderBar(player);

    // When
    await act(async () => {
      fireGestureHandler(getByGestureTestId('voice-note-scrubber'), [
        { state: State.BEGAN, x: 50 },
        { state: State.END, x: 900 },
      ]);
    });

    // Then
    expect(player.seekTo).toHaveBeenCalledWith(120_000);
  });

  it('화면이 사라지면 재생 위치 구독을 푼다', async () => {
    // Given
    const { player, getListenerCount } = createPlayerStub();
    const { unmount } = await renderBar(player);

    // When
    await act(async () => unmount());

    // Then
    expect(getListenerCount()).toBe(0);
  });

  it('녹음을 쓸 수 없으면 재생 대신 안내를 보여 준다', async () => {
    // Given
    const { player } = createPlayerStub();

    // When
    await renderScreen(
      <VoiceNotePlayerBar
        player={player}
        levels={LEVELS}
        flagIndexes={[]}
        isRecordingAvailable={false}
      />,
    );

    // Then
    expect(screen.queryByLabelText('재생 위치')).toBeNull();
  });
});
