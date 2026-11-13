import { toInstant } from '@src/shared/date/instant';

import { createLocalFileEntry } from '../__tests__/voice.fixtures';
import { VoiceRecordingFilePolicy } from './voice-recording-file.model';

describe('VoiceRecordingFilePolicy.isRecordingFileExpired', () => {
  const now = toInstant('2026-11-05T01:00:00.000Z');

  it.each([
    { scenario: '수정 시각을 모르는 파일', modifiedAtMs: null, expected: true },
    {
      scenario: '수정한 지 1시간이 되기 직전',
      modifiedAtMs: Date.parse('2026-11-05T00:00:00.001Z'),
      expected: false,
    },
    {
      scenario: '수정한 지 1시간이 되는 순간',
      modifiedAtMs: Date.parse('2026-11-05T00:00:00.000Z'),
      expected: true,
    },
  ])('$scenario이면 만료인지: $expected', ({ modifiedAtMs, expected }) => {
    // When
    const result = VoiceRecordingFilePolicy.isRecordingFileExpired(
      createLocalFileEntry({ modifiedAtMs }),
      now,
    );

    // Then
    expect(result).toBe(expected);
  });
});
