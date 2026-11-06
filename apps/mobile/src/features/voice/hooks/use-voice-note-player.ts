import { useLogger } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { clamp } from 'es-toolkit';
import {
  type AudioPlaylist,
  type AudioPlaylistStatus,
  setAudioModeAsync,
  useAudioPlaylist,
} from 'expo-audio';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { VOICE_NOTE_LOG_EVENT } from '../constants/voice-note-log-events';
import { VOICE_NOTE_POSITION_INTERVAL_MS } from '../constants/voice-note.constants';
import { VoiceNotePolicy } from '../domains/voice-note.model';

const SECOND_MS = 1_000;

export interface VoiceNotePlayerPart {
  uri: string;
  startMs: number;
}

interface UseVoiceNotePlayerOptions {
  /** 시간 순서의 녹음 조각. 없으면 재생할 수 없는 상태로 둔다. 플레이어가 살아 있는 동안 바꾸지 않는다 */
  parts: readonly VoiceNotePlayerPart[];
  durationMs: number;
}

export interface VoiceNotePlayback {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

export interface VoiceNotePlayer {
  subscribe: (listener: () => void) => () => void;
  getPlayback: () => VoiceNotePlayback;
  togglePlay: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  playFrom: (positionMs: number) => Promise<void>;
}

interface PendingStart {
  index: number;
  offsetSeconds: number;
  shouldPlay: boolean;
}

interface CreatePlayerInput extends UseVoiceNotePlayerOptions {
  playlist: AudioPlaylist;
  logger: Pick<Logger, 'warn'>;
}

function createVoiceNotePlayer({ playlist, parts, durationMs, logger }: CreatePlayerInput) {
  const listeners = new Set<() => void>();
  const lastIndex = parts.length - 1;
  let status: AudioPlaylistStatus = playlist.currentStatus;
  /** 마지막 조각까지 다 들었다. iOS는 이때 현재 항목이 사라져 시간·길이가 0이 되므로 따로 기억한다 */
  let hasFinished = false;
  let resolvedDurationMs = durationMs;
  let pendingStart: PendingStart | null = null;

  const createPlayback = (): VoiceNotePlayback => {
    if (status.currentIndex === lastIndex) {
      const lastStartMs = parts[lastIndex]?.startMs ?? 0;
      resolvedDurationMs = Math.max(
        resolvedDurationMs,
        lastStartMs + Math.round(status.duration * SECOND_MS),
      );
    }
    const partStartMs = parts[status.currentIndex]?.startMs ?? 0;

    return {
      isLoaded: hasFinished || status.isLoaded,
      isPlaying: !hasFinished && status.playing,
      positionMs: hasFinished
        ? resolvedDurationMs
        : Math.min(partStartMs + Math.round(status.currentTime * SECOND_MS), resolvedDurationMs),
      durationMs: resolvedDurationMs,
    };
  };
  let playback = createPlayback();

  const seekInCurrentPart = async (offsetSeconds: number) => {
    try {
      await playlist.seekTo(offsetSeconds);
    } catch (error) {
      logger.warn(VOICE_NOTE_LOG_EVENT.PLAYER_SEEK_FAILED, { error: getErrorMessage(error) });
    }
  };

  /**
   * iOS는 항목이 준비되기 전에 위치를 옮기면 무시되거나 예외가 난다. 이벤트는 교체 전 값일 수 있어
   * 플레이어의 현재 값(`playlist.isLoaded`)까지 확인한 뒤에 적용한다.
   */
  const applyPendingStart = () => {
    const pending = pendingStart;
    if (
      pending == null ||
      status.currentIndex !== pending.index ||
      !status.isLoaded ||
      !playlist.isLoaded
    ) {
      return;
    }
    pendingStart = null;
    seekInCurrentPart(pending.offsetSeconds)
      .then(() => {
        if (pending.shouldPlay) {
          playlist.play();
        }
      })
      .catch((error: unknown) => {
        logger.warn(VOICE_NOTE_LOG_EVENT.PLAYER_SEEK_FAILED, {
          step: 'play-after-seek',
          error: getErrorMessage(error),
        });
      });
  };

  const moveTo = async (target: number, shouldPlay: boolean) => {
    const index = VoiceNotePolicy.findRecordingIndexAt(parts, target);
    const part = parts[index];
    if (part == null) {
      return;
    }
    const clamped = clamp(target, 0, resolvedDurationMs);
    const offsetSeconds = Math.max(0, clamped - part.startMs) / SECOND_MS;
    if (index === status.currentIndex && !hasFinished && playlist.isLoaded) {
      await seekInCurrentPart(offsetSeconds);
      if (shouldPlay) {
        playlist.play();
      }
      return;
    }
    hasFinished = false;
    pendingStart = { index, offsetSeconds, shouldPlay };
    playlist.pause();
    playlist.skipTo(index);
  };

  const notify = () => {
    playback = createPlayback();
    listeners.forEach((listener) => listener());
  };

  const handleStatus = (next: AudioPlaylistStatus) => {
    status = next;
    // 종료 표시는 이벤트 하나에만 실린다. 렌더에 묶이면 놓치므로 이벤트에서 바로 읽는다
    if (next.didJustFinish) {
      hasFinished = true;
    }
    applyPendingStart();
    notify();
  };

  const isAtEnd = () =>
    status.currentIndex === lastIndex &&
    status.duration > 0 &&
    status.currentTime >= status.duration;

  return {
    attach: () => {
      const subscription = playlist.addListener('playlistStatusUpdate', handleStatus);
      return () => subscription.remove();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getPlayback: () => playback,
    togglePlay: async () => {
      if (status.playing) {
        playlist.pause();
        return;
      }
      if (hasFinished || isAtEnd()) {
        await moveTo(0, true);
        return;
      }
      playlist.play();
    },
    seekTo: (target: number) => moveTo(target, false),
    playFrom: (target: number) => moveTo(target, true),
  };
}

/**
 * 멈췄다 이어 들은 녹음은 파일이 여러 개라 `expo-audio`의 `AudioPlaylist`로 조각을 이어 하나처럼 재생한다.
 * 다음 조각으로 넘어가는 일은 네이티브 큐가 맡아 JS가 늦어도 멈추지 않는다. 플레이어는 이 훅을 쓰는 화면이 소유해
 * 화면이 사라지면 `useAudioPlaylist`가 해제한다. 재생 위치는 여기서 구독하지 않아 화면 전체가 다시 그려지지 않는다.
 */
export function useVoiceNotePlayer({
  parts,
  durationMs,
}: UseVoiceNotePlayerOptions): VoiceNotePlayer {
  const logger = useLogger();
  const playlist = useAudioPlaylist({
    sources: parts.map(({ uri }) => ({ uri })),
    updateInterval: VOICE_NOTE_POSITION_INTERVAL_MS,
  });
  const player = useMemo(
    () => createVoiceNotePlayer({ playlist, parts, durationMs, logger }),
    [playlist, parts, durationMs, logger],
  );

  useEffect(() => player.attach(), [player]);

  useEffect(() => {
    // 인식 중에 켜진 녹음 모드가 남아 있으면 무음 모드에서 소리가 안 난다
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(
      (error: unknown) => {
        logger.warn(VOICE_NOTE_LOG_EVENT.PLAYER_AUDIO_MODE_FAILED, {
          error: getErrorMessage(error),
        });
      },
    );
  }, [logger]);

  return player;
}

export function useVoiceNotePlayback<TSelected>(
  player: VoiceNotePlayer,
  select: (playback: VoiceNotePlayback) => TSelected,
): TSelected {
  return useSyncExternalStore(player.subscribe, () => select(player.getPlayback()));
}
