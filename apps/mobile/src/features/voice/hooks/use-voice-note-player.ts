import { useLogger } from '@src/bootstrap/providers/di-context';
import type { AppLogger } from '@src/core/ports/app-logger';
import type {
  AudioPartPlaylist,
  AudioPartPlaylistStatus,
} from '@src/core/ports/audio-part-playlist';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useAudioPartPlaylist } from '@src/shared/infra/audio/use-audio-part-playlist';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import { VOICE_NOTE_POSITION_INTERVAL_MS } from '../constants/voice-note.constants';
import {
  findPartSeek,
  getVoiceNotePlayback,
  type VoiceNotePlayback,
} from '../utils/voice-note-playback';

interface VoiceNotePlayerPart {
  uri: string;
  startMs: number;
}

interface UseVoiceNotePlayerOptions {
  /** 시간 순서의 녹음 조각. 없으면 재생할 수 없는 상태로 둔다. 플레이어가 살아 있는 동안 바꾸지 않는다 */
  parts: readonly VoiceNotePlayerPart[];
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
  playlist: AudioPartPlaylist;
  logger: Pick<AppLogger, 'warn'>;
}

function createVoiceNotePlayer({ playlist, parts, durationMs, logger }: CreatePlayerInput) {
  const listeners = new Set<() => void>();
  const lastIndex = parts.length - 1;
  let status: AudioPartPlaylistStatus = playlist.currentStatus;
  let pendingStart: PendingStart | null = null;
  let { playback, memory } = getVoiceNotePlayback(status, parts, {
    hasFinished: false,
    resolvedDurationMs: durationMs,
  });

  const seekInCurrentPart = async (offsetSeconds: number) => {
    try {
      await playlist.seekTo(offsetSeconds);
    } catch (error) {
      logger.warn(VOICE_LOG_EVENT.PLAYER_SEEK_FAILED, { error: getErrorMessage(error) });
    }
  };

  /** iOS는 준비 전 위치 이동을 무시하거나 던지고 이벤트는 교체 전 값일 수 있어 playlist.isLoaded까지 본다 */
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
        logger.warn(VOICE_LOG_EVENT.PLAYER_SEEK_FAILED, {
          step: 'play-after-seek',
          error: getErrorMessage(error),
        });
      });
  };

  const moveTo = async (target: number, shouldPlay: boolean) => {
    const seek = findPartSeek(parts, target, memory.resolvedDurationMs);
    if (seek == null) {
      return;
    }
    const { index, offsetSeconds } = seek;
    if (index === status.currentIndex && !memory.hasFinished && playlist.isLoaded) {
      await seekInCurrentPart(offsetSeconds);
      if (shouldPlay) {
        playlist.play();
      }
      return;
    }
    memory = { ...memory, hasFinished: false };
    pendingStart = { index, offsetSeconds, shouldPlay };
    playlist.pause();
    playlist.skipTo(index);
  };

  const notify = () => {
    ({ playback, memory } = getVoiceNotePlayback(status, parts, memory));
    listeners.forEach((listener) => listener());
  };

  const handleStatus = (next: AudioPartPlaylistStatus) => {
    status = next;
    // 종료 표시는 이벤트 하나에만 실린다. 렌더에 묶이면 놓치므로 이벤트에서 바로 읽는다
    if (next.didJustFinish) {
      memory = { ...memory, hasFinished: true };
    }
    applyPendingStart();
    notify();
  };

  const isAtEnd = () =>
    status.currentIndex === lastIndex &&
    status.duration > 0 &&
    status.currentTime >= status.duration;

  return {
    attach: () => playlist.subscribe(handleStatus),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getPlayback: () => playback,
    togglePlay: async () => {
      if (status.isPlaying) {
        playlist.pause();
        return;
      }
      if (memory.hasFinished || isAtEnd()) {
        await moveTo(0, true);
        return;
      }
      playlist.play();
    },
    seekTo: (target: number) => moveTo(target, false),
    playFrom: (target: number) => moveTo(target, true),
  };
}

/** 조각 넘기기는 네이티브 큐가 맡아 JS가 늦어도 멈추지 않고, 재생 위치는 구독하지 않아 화면을 다시 그리지 않는다 */
export function useVoiceNotePlayer({
  parts,
  durationMs,
}: UseVoiceNotePlayerOptions): VoiceNotePlayer {
  const logger = useLogger();
  const playlist = useAudioPartPlaylist({
    uris: parts.map(({ uri }) => uri),
    updateIntervalMs: VOICE_NOTE_POSITION_INTERVAL_MS,
  });
  // 끝까지 들었다는 기억을 들고 있어 useMemo 캐시에 맡기지 않는다
  const [player] = useState(() => createVoiceNotePlayer({ playlist, parts, durationMs, logger }));

  useEffect(() => player.attach(), [player]);

  useEffect(() => {
    playlist.prepareForPlayback().catch((error: unknown) => {
      logger.warn(VOICE_LOG_EVENT.PLAYER_AUDIO_MODE_FAILED, {
        error: getErrorMessage(error),
      });
    });
  }, [logger, playlist]);

  return player;
}

export function useVoiceNotePlayback<TSelected>(
  player: VoiceNotePlayer,
  select: (playback: VoiceNotePlayback) => TSelected,
): TSelected {
  return useSyncExternalStore(player.subscribe, () => select(player.getPlayback()));
}
