import { toVoiceNotePlayback } from './voice-note-playback.mapper';

const PARTS = [{ startMs: 0 }, { startMs: 60_000 }];
const STATUS = {
  currentIndex: 0,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isLoaded: true,
};
const MEMORY = { hasFinished: false, resolvedDurationMs: 120_000 };

describe('toVoiceNotePlayback', () => {
  it('조각 안의 위치를 노트 시계로 바꾼다', () => {
    // When
    const { playback } = toVoiceNotePlayback(
      { ...STATUS, currentIndex: 1, currentTime: 2 },
      PARTS,
      MEMORY,
    );

    // Then
    expect(playback.positionMs).toBe(62_000);
  });

  it('마지막 조각의 실제 길이가 더 길면 전체 길이를 늘려 기억한다', () => {
    // When
    const { playback, memory } = toVoiceNotePlayback(
      { ...STATUS, currentIndex: 1, duration: 70 },
      PARTS,
      MEMORY,
    );

    // Then
    expect(playback.durationMs).toBe(130_000);
    expect(memory.resolvedDurationMs).toBe(130_000);
  });

  it('다 들었으면 항목이 사라져도 끝 위치에 멈춰 있다', () => {
    // When
    const { playback } = toVoiceNotePlayback(
      { ...STATUS, currentIndex: 1, isPlaying: true, isLoaded: false },
      PARTS,
      { ...MEMORY, hasFinished: true },
    );

    // Then
    expect(playback).toEqual({
      isLoaded: true,
      isPlaying: false,
      positionMs: 120_000,
      durationMs: 120_000,
    });
  });
});
