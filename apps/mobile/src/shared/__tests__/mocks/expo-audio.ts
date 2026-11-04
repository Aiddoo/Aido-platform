// expo-audio 네이티브 플레이어 fake (jest.config.js moduleNameMapper에서 매핑)
import { useState } from 'react';

interface FakeStatus {
  currentIndex: number;
  currentTime: number;
  duration: number;
  playing: boolean;
  isLoaded: boolean;
  didJustFinish: boolean;
}

export class FakeAudioPlaylist {
  readonly listeners = new Set<(status: FakeStatus) => void>();
  readonly play = jest.fn();
  readonly pause = jest.fn();
  readonly skipTo = jest.fn();
  readonly seekTo = jest.fn(() => Promise.resolve());
  readonly sources: readonly { uri: string }[];
  /** 네이티브 플레이어가 지금 준비됐는지. 이벤트의 값과 다를 수 있다 */
  isLoaded = true;
  currentStatus: FakeStatus = {
    currentIndex: 0,
    currentTime: 0,
    duration: 0,
    playing: false,
    isLoaded: true,
    didJustFinish: false,
  };

  constructor(sources: readonly { uri: string }[]) {
    this.sources = sources;
  }

  addListener(_eventName: string, listener: (status: FakeStatus) => void) {
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }

  /** 네이티브가 재생 상태 이벤트를 보낸 것처럼 알린다 */
  emitStatus(overrides: Partial<FakeStatus>) {
    this.currentStatus = { ...this.currentStatus, didJustFinish: false, ...overrides };
    this.isLoaded = this.currentStatus.isLoaded;
    for (const listener of this.listeners) {
      listener(this.currentStatus);
    }
  }
}

let lastPlaylist: FakeAudioPlaylist | undefined;

export function getLastAudioPlaylist() {
  if (lastPlaylist == null) {
    throw new Error('아직 만든 AudioPlaylist가 없습니다');
  }
  return lastPlaylist;
}

export function useAudioPlaylist({ sources = [] }: { sources?: readonly { uri: string }[] }) {
  const [playlist] = useState(() => {
    lastPlaylist = new FakeAudioPlaylist(sources);
    return lastPlaylist;
  });
  return playlist;
}

export const setAudioModeAsync = jest.fn(() => Promise.resolve());
