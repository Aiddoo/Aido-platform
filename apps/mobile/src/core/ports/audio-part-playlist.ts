export interface AudioPartPlaylistStatus {
  currentIndex: number;
  /** 지금 조각 안에서의 위치(초) */
  currentTime: number;
  /** 지금 조각의 길이(초) */
  duration: number;
  playing: boolean;
  isLoaded: boolean;
  /** 마지막 조각까지 다 들은 순간의 이벤트 하나에만 실린다 */
  didJustFinish: boolean;
}

/** 여러 녹음 조각을 하나처럼 이어 재생한다. 다음 조각으로 넘어가는 일은 네이티브 큐가 맡는다 */
export interface AudioPartPlaylist {
  readonly currentStatus: AudioPartPlaylistStatus;
  /** 플레이어의 지금 값. 이벤트에 실린 값은 조각을 바꾸기 전 값일 수 있다 */
  readonly isLoaded: boolean;
  play(): void;
  pause(): void;
  skipTo(index: number): void;
  /** 지금 조각 안에서 옮긴다(초) */
  seekTo(seconds: number): Promise<void>;
  subscribe(listener: (status: AudioPartPlaylistStatus) => void): () => void;
  /** 인식 중에 켜진 녹음 모드가 남아 있으면 무음 모드에서 소리가 안 나므로 재생용 오디오 모드로 돌린다 */
  prepareForPlayback(): Promise<void>;
}
