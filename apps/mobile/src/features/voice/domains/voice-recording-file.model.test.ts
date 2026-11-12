import { toInstant } from '@src/shared/date/instant';

import { createLocalFileEntry } from '../__tests__/voice.fixtures';
import { VoiceRecordingFilePolicy } from './voice-recording-file.model';

describe('VoiceRecordingFilePolicy.isRecordingFileExpired', () => {
  const now = toInstant('2026-11-05T01:00:00.000Z');

  it('수정 시각을 모르는 파일은 기한이 지난 것으로 본다', () => {
    // When
    const result = VoiceRecordingFilePolicy.isRecordingFileExpired(
      createLocalFileEntry({ modifiedAt: null }),
      now,
    );

    // Then
    expect(result).toBe(true);
  });

  it('수정한 지 1시간이 되기 직전까지는 만료되지 않는다', () => {
    // Given
    const modifiedAt = new Date('2026-11-05T00:00:00.001Z');

    // When
    const result = VoiceRecordingFilePolicy.isRecordingFileExpired(
      createLocalFileEntry({ modifiedAt }),
      now,
    );

    // Then
    expect(result).toBe(false);
  });

  it('수정한 지 1시간이 되는 순간 만료된다', () => {
    // Given
    const modifiedAt = new Date('2026-11-05T00:00:00.000Z');

    // When
    const result = VoiceRecordingFilePolicy.isRecordingFileExpired(
      createLocalFileEntry({ modifiedAt }),
      now,
    );

    // Then
    expect(result).toBe(true);
  });
});
