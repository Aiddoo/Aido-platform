/** 인식기가 준 단어 구간. iOS·Android 14+ 기기 안 인식에서만 온다. */
export interface SpeechSegment {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}
