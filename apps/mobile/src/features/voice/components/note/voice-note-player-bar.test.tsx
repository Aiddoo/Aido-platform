import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Profiler } from 'react';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { VoiceNotePlayer } from '../../hooks/use-voice-note-player';
import type { VoiceNotePlayback } from '../../utils/voice-note-playback';
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
  const view = await renderUi(
    <VoiceNotePlayerBar player={player} levels={LEVELS} flagIndexes={[1]} isRecordingAvailable />,
  );
  // 칸 계산은 화면 폭을 받은 뒤에 한다
  await fireEvent(screen.getByLabelText('재생 위치'), 'layout', {
    nativeEvent: { layout: { width: 200, height: 32 } },
  });
  return view;
}

describe('VoiceNotePlayerBar', () => {
  test('재생 위치와 전체 길이를 글자로 보여 주고 초가 바뀔 때 갱신한다', async () => {
    // Given
    const { player, emit } = createPlayerStub({ positionMs: 5_000 });
    await renderBar(player);

    // Then
    expect(screen.getByText('0:05 / 2:00')).toBeOnTheScreen();

    // When
    await act(async () => emit({ positionMs: 6_400 }));

    // Then
    expect(screen.getByText('0:06 / 2:00')).toBeOnTheScreen();
  });

  test('드래그를 끝낸 위치로 옮긴다', async () => {
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

  test('화면 밖까지 끌어도 노트 범위 안으로 옮긴다', async () => {
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

  test('같은 초 안에서는 재생 위치가 바뀌어도 다시 그리지 않고 초가 바뀌면 그린다', async () => {
    // Given
    const { player, emit } = createPlayerStub({ positionMs: 5_000 });
    const onRender = jest.fn();
    await renderUi(
      <Profiler id="player-bar" onRender={onRender}>
        <VoiceNotePlayerBar player={player} levels={LEVELS} flagIndexes={[]} isRecordingAvailable />
      </Profiler>,
    );
    onRender.mockClear();

    // When
    await act(async () => emit({ positionMs: 5_100 }));
    await act(async () => emit({ positionMs: 5_900 }));

    // Then
    expect(onRender).not.toHaveBeenCalled();

    // When
    await act(async () => emit({ positionMs: 6_000 }));

    // Then
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  test('화면이 사라지면 재생 위치 구독을 푼다', async () => {
    // Given
    const { player, getListenerCount } = createPlayerStub();
    const { unmount } = await renderBar(player);

    // When
    await act(async () => unmount());

    // Then
    expect(getListenerCount()).toBe(0);
  });

  test('녹음을 쓸 수 없으면 재생 대신 안내를 보여 준다', async () => {
    // Given
    const { player } = createPlayerStub();

    // When
    await renderUi(
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
