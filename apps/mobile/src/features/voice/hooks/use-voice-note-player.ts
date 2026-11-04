import { useLogger } from '@src/bootstrap/providers/di-context';
import { errorMessageOf } from '@src/shared/errors/to-error';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect } from 'react';

import { VOICE_NOTE_LOG_EVENT } from '../constants/voice-note-log-events';
import { VOICE_NOTE_POSITION_INTERVAL_MS } from '../constants/voice-note.constants';

const SECOND_MS = 1_000;

interface UseVoiceNotePlayerOptions {
  /** 녹음 파일 URI. 없으면 재생할 수 없는 상태로 둔다 */
  uri: string | undefined;
  /** 파일 길이를 읽기 전에 쓸 노트의 길이 */
  durationMs: number;
}

export interface VoiceNotePlayer {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  /** 그 지점부터 바로 들려준다(핵심 포인트 누르기) */
  playFrom: (positionMs: number) => Promise<void>;
}

/**
 * `expo-audio` 플레이어와 상태 구독을 하나로 감싼다. 플레이어는 이 훅을 쓰는 화면이 소유해
 * 화면이 사라지면 `useAudioPlayer`가 해제하고 위치 구독도 함께 끝난다.
 */
export function useVoiceNotePlayer({
  uri,
  durationMs,
}: UseVoiceNotePlayerOptions): VoiceNotePlayer {
  const logger = useLogger();
  const player = useAudioPlayer(uri == null ? null : { uri }, {
    updateInterval: VOICE_NOTE_POSITION_INTERVAL_MS,
  });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    // 인식 중에 켜진 녹음 모드가 남아 있으면 무음 모드에서 소리가 안 난다
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(
      (error: unknown) => {
        logger.warn(VOICE_NOTE_LOG_EVENT.PLAYER_AUDIO_MODE_FAILED, {
          error: errorMessageOf(error),
        });
      },
    );
  }, [logger]);

  const loadedDurationMs = Math.round(status.duration * SECOND_MS);
  const resolvedDurationMs = loadedDurationMs > 0 ? loadedDurationMs : durationMs;
  const positionMs = Math.min(Math.round(status.currentTime * SECOND_MS), resolvedDurationMs);

  const seekTo = async (target: number) => {
    const clamped = Math.min(Math.max(0, target), resolvedDurationMs);
    try {
      await player.seekTo(clamped / SECOND_MS);
    } catch (error) {
      logger.warn(VOICE_NOTE_LOG_EVENT.PLAYER_SEEK_FAILED, {
        error: errorMessageOf(error),
      });
    }
  };

  const playFrom = async (target: number) => {
    await seekTo(target);
    player.play();
  };

  const togglePlay = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) {
      await playFrom(0);
      return;
    }
    player.play();
  };

  return {
    isLoaded: status.isLoaded,
    isPlaying: status.playing,
    positionMs,
    durationMs: resolvedDurationMs,
    play: () => player.play(),
    pause: () => player.pause(),
    togglePlay,
    seekTo,
    playFrom,
  };
}
