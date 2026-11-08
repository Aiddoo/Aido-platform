import type {
  AudioPartPlaylist,
  AudioPartPlaylistStatus,
} from '@src/core/ports/audio-part-playlist';
import {
  type AudioPlaylist,
  type AudioPlaylistStatus,
  setAudioModeAsync,
  useAudioPlaylist,
} from 'expo-audio';
import { useMemo } from 'react';

function toAudioPartPlaylistStatus(status: AudioPlaylistStatus): AudioPartPlaylistStatus {
  return {
    currentIndex: status.currentIndex,
    currentTime: status.currentTime,
    duration: status.duration,
    isPlaying: status.playing,
    isLoaded: status.isLoaded,
    didJustFinish: status.didJustFinish,
  };
}

function toAudioPartPlaylist(playlist: AudioPlaylist): AudioPartPlaylist {
  return {
    get currentStatus() {
      return toAudioPartPlaylistStatus(playlist.currentStatus);
    },
    get isLoaded() {
      return playlist.isLoaded;
    },
    play: () => playlist.play(),
    pause: () => playlist.pause(),
    skipTo: (index) => playlist.skipTo(index),
    seekTo: (seconds) => playlist.seekTo(seconds),
    subscribe: (listener) => {
      const subscription = playlist.addListener('playlistStatusUpdate', (status) =>
        listener(toAudioPartPlaylistStatus(status)),
      );
      return () => subscription.remove();
    },
    prepareForPlayback: () =>
      setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }),
  };
}

/** `useAudioPlaylistStatus`는 이벤트마다 화면 전체를 다시 그리므로 구독을 포트로 넘긴다 */
export function useAudioPartPlaylist({
  uris,
  updateIntervalMs,
}: {
  uris: readonly string[];
  updateIntervalMs: number;
}): AudioPartPlaylist {
  const playlist = useAudioPlaylist({
    sources: uris.map((uri) => ({ uri })),
    updateInterval: updateIntervalMs,
  });

  return useMemo(() => toAudioPartPlaylist(playlist), [playlist]);
}
