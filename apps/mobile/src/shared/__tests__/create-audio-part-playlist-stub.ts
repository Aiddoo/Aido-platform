import type {
  AudioPartPlaylist,
  AudioPartPlaylistStatus,
} from '@src/core/ports/audio-part-playlist';

import { mockMethod } from './mock-method';

/** 불러온 뒤 멈춰 있는 재생 목록이 기본값이다. 재생 중인 상태는 `status`로 정한다 */
export function createAudioPartPlaylistStub(
  status: Partial<AudioPartPlaylistStatus> = {},
): jest.Mocked<AudioPartPlaylist> {
  return {
    currentStatus: {
      currentIndex: 0,
      currentTime: 0,
      duration: 0,
      playing: false,
      isLoaded: true,
      didJustFinish: false,
      ...status,
    },
    isLoaded: status.isLoaded ?? true,
    play: jest.fn(),
    pause: jest.fn(),
    skipTo: jest.fn(),
    seekTo: mockMethod<AudioPartPlaylist['seekTo']>(async () => {}),
    subscribe: mockMethod<AudioPartPlaylist['subscribe']>(() => () => {}),
    prepareForPlayback: mockMethod<AudioPartPlaylist['prepareForPlayback']>(async () => {}),
  };
}
