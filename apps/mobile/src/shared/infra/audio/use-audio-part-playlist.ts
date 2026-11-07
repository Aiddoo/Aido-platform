import type { AudioPartPlaylist } from '@src/core/ports/audio-part-playlist';
import { type AudioPlaylist, setAudioModeAsync, useAudioPlaylist } from 'expo-audio';
import { useMemo } from 'react';

function toAudioPartPlaylist(playlist: AudioPlaylist): AudioPartPlaylist {
  return {
    get currentStatus() {
      return playlist.currentStatus;
    },
    get isLoaded() {
      return playlist.isLoaded;
    },
    play: () => playlist.play(),
    pause: () => playlist.pause(),
    skipTo: (index) => playlist.skipTo(index),
    seekTo: (seconds) => playlist.seekTo(seconds),
    subscribe: (listener) => {
      const subscription = playlist.addListener('playlistStatusUpdate', listener);
      return () => subscription.remove();
    },
    prepareForPlayback: () =>
      setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }),
  };
}

/**
 * 라이브러리 자체가 React 훅이라 경계 훅으로 둔다. 이 훅을 쓴 화면이 사라지면 재생 목록도 해제된다.
 * `useAudioPlaylistStatus`는 이벤트마다 state를 바꿔 화면 전체를 다시 그리므로 구독을 포트로 넘긴다.
 */
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
