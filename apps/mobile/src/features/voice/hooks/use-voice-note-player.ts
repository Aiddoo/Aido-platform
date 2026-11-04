import { useLogger } from '@src/bootstrap/providers/di-context';
import { errorMessageOf } from '@src/shared/errors/to-error';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { VOICE_NOTE_LOG_EVENT } from '../constants/voice-note-log-events';
import { VOICE_NOTE_POSITION_INTERVAL_MS } from '../constants/voice-note.constants';
import { VoiceNotePolicy } from '../domains/voice-note.model';

const SECOND_MS = 1_000;

/** 녹음 파일 한 조각. `startMs`는 노트 시계에서 이 조각이 시작하는 곳이다 */
export interface VoiceNotePlayerPart {
  uri: string;
  startMs: number;
}

interface UseVoiceNotePlayerOptions {
  /** 시간 순서의 녹음 조각. 없으면 재생할 수 없는 상태로 둔다 */
  parts: readonly VoiceNotePlayerPart[];
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
 * 멈췄다 이어 들은 녹음은 파일이 여러 개라 조각을 차례로 이어 하나처럼 재생한다.
 */
export function useVoiceNotePlayer({
  parts,
  durationMs,
}: UseVoiceNotePlayerOptions): VoiceNotePlayer {
  const logger = useLogger();
  const firstUri = parts[0]?.uri;
  const player = useAudioPlayer(firstUri == null ? null : { uri: firstUri }, {
    updateInterval: VOICE_NOTE_POSITION_INTERVAL_MS,
  });
  const status = useAudioPlayerStatus(player);
  const [partIndex, setPartIndex] = useState(0);
  const pendingStartRef = useRef<{ offsetSeconds: number; shouldPlay: boolean } | null>(null);

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

  const seekInCurrentPart = async (offsetSeconds: number) => {
    try {
      await player.seekTo(offsetSeconds);
    } catch (error) {
      logger.warn(VOICE_NOTE_LOG_EVENT.PLAYER_SEEK_FAILED, { error: errorMessageOf(error) });
    }
  };

  /** 다른 조각으로 갈 때는 파일이 열린 뒤에 위치를 옮긴다 */
  const loadPart = (index: number, offsetSeconds: number, shouldPlay: boolean) => {
    const part = parts[index];
    if (part == null) {
      return;
    }
    pendingStartRef.current = { offsetSeconds, shouldPlay };
    player.replace({ uri: part.uri });
    setPartIndex(index);
  };

  const applyPendingStart = async () => {
    const pending = pendingStartRef.current;
    if (pending == null) {
      return;
    }
    pendingStartRef.current = null;
    await seekInCurrentPart(pending.offsetSeconds);
    if (pending.shouldPlay) {
      player.play();
    }
  };

  const { isLoaded, didJustFinish } = status;
  useEffect(() => {
    if (isLoaded) {
      applyPendingStart().catch(() => undefined);
    }
    // 파일이 열렸을 때만 옮긴다
  }, [isLoaded, partIndex]);

  const hasNextPart = partIndex < parts.length - 1;
  useEffect(() => {
    if (didJustFinish && hasNextPart) {
      loadPart(partIndex + 1, 0, true);
    }
    // 조각 하나가 끝났을 때만 다음으로 넘어간다
  }, [didJustFinish, hasNextPart]);

  const partStartMs = parts[partIndex]?.startMs ?? 0;
  const lastPart = parts.at(-1);
  const loadedDurationMs =
    partIndex === parts.length - 1 && lastPart != null
      ? lastPart.startMs + Math.round(status.duration * SECOND_MS)
      : 0;
  const resolvedDurationMs = Math.max(loadedDurationMs, durationMs);
  const positionMs = Math.min(
    partStartMs + Math.round(status.currentTime * SECOND_MS),
    resolvedDurationMs,
  );

  const moveTo = async (target: number, shouldPlay: boolean) => {
    const clamped = Math.min(Math.max(0, target), resolvedDurationMs);
    const index = VoiceNotePolicy.findRecordingIndexAt(parts, clamped);
    const offsetSeconds = Math.max(0, clamped - (parts[index]?.startMs ?? 0)) / SECOND_MS;
    if (index !== partIndex) {
      loadPart(index, offsetSeconds, shouldPlay);
      return;
    }
    await seekInCurrentPart(offsetSeconds);
    if (shouldPlay) {
      player.play();
    }
  };

  const seekTo = (target: number) => moveTo(target, false);
  const playFrom = (target: number) => moveTo(target, true);

  const togglePlay = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish && !hasNextPart) {
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
