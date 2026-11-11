import { toEpochMs, toInstant } from '@src/shared/date/instant';
import { createLocalFileSystemFake, createLoggerStub } from '@src/testing/core';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import { createVoiceRecordingRepository } from './voice-recording.repository';

const NOW = toInstant('2026-12-05T00:00:00.000Z');
const OWNER_DIRECTORY = ['voice-notes', 'user-1'];

function createRepository() {
  const files = createLocalFileSystemFake();
  const logger = createLoggerStub();

  return { files, logger, repository: createVoiceRecordingRepository(files, logger) };
}

describe('VoiceRecordingRepository', () => {
  it('인식기가 쓴 파일을 초안 이름으로 옮겨 계정 폴더에 둔다', async () => {
    // Given
    const { files, repository } = createRepository();
    const sourceUri = files.addFile(OWNER_DIRECTORY, 'recording_abc.wav', { sizeBytes: 1_900_000 });

    // When
    const fileName = await repository.save({
      accountId: 'user-1',
      draftId: 'draft-1',
      partIndex: 0,
      sourceUri,
    });

    // Then
    expect(fileName).toBe('draft-1-0.wav');
    expect(repository.findUri('user-1', 'draft-1-0.wav')).not.toBeNull();
    expect(files.hasFile(OWNER_DIRECTORY, 'recording_abc.wav')).toBe(false);
  });

  it('옮기기 전의 파일을 URI로 지운다', () => {
    // Given
    const { files, repository } = createRepository();
    const sourceUri = files.addFile(OWNER_DIRECTORY, 'recording_abc.wav');

    // When
    repository.removeSource(sourceUri);

    // Then
    expect(files.hasFile(OWNER_DIRECTORY, 'recording_abc.wav')).toBe(false);
  });

  it('옮기지 못하면 save-failed를 남기고 null을 돌려줘 글자만 남게 한다', async () => {
    // Given
    const { files, logger, repository } = createRepository();
    const sourceUri = files.addFile(OWNER_DIRECTORY, 'recording_abc.wav');
    files.failNextMove(new Error('ENOSPC'));

    // When
    const fileName = await repository.save({
      accountId: 'user-1',
      draftId: 'draft-1',
      partIndex: 0,
      sourceUri,
    });

    // Then
    expect(fileName).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(VOICE_LOG_EVENT.RECORDING_SAVE_FAILED, {
      stage: 'move',
      error: 'ENOSPC',
    });
  });

  it('녹음 폴더를 만들지 못하면 save-failed를 남기고 null을 돌려준다', () => {
    // Given
    const { files, logger, repository } = createRepository();
    files.failNextEnsureDirectory(new Error('EACCES'));

    // When
    const directory = repository.prepareDirectory('user-1');

    // Then
    expect(directory).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(VOICE_LOG_EVENT.RECORDING_SAVE_FAILED, {
      stage: 'prepare',
      error: 'EACCES',
    });
  });

  it('초안이 가리키지 않고 한 시간이 지난 파일만 지운다', () => {
    // Given
    const { files, repository } = createRepository();
    const old = new Date('2026-11-01T00:00:00.000Z');
    files.addFile(OWNER_DIRECTORY, 'orphan-old.wav', { modifiedAt: old });
    files.addFile(OWNER_DIRECTORY, 'referenced-old.wav', { modifiedAt: old });
    files.addFile(OWNER_DIRECTORY, 'orphan-new.wav', {
      modifiedAt: new Date(toEpochMs(NOW) - 10 * 60 * 1_000),
    });

    // When
    repository.removeExpired('user-1', NOW, new Set(['referenced-old.wav']));

    // Then
    expect(files.hasFile(OWNER_DIRECTORY, 'orphan-old.wav')).toBe(false);
    expect(files.hasFile(OWNER_DIRECTORY, 'referenced-old.wav')).toBe(true);
    expect(files.hasFile(OWNER_DIRECTORY, 'orphan-new.wav')).toBe(true);
  });

  it('다른 계정의 녹음 폴더만 지우고 현재 계정은 남긴다', () => {
    // Given
    const { files, repository } = createRepository();
    files.addFile(OWNER_DIRECTORY, 'a.wav');
    files.addFile(['voice-notes', 'user-2'], 'b.wav');

    // When
    repository.removeAllExceptOwner('user-1');

    // Then
    expect(files.hasFile(OWNER_DIRECTORY, 'a.wav')).toBe(true);
    expect(files.hasFile(['voice-notes', 'user-2'], 'b.wav')).toBe(false);
  });

  it('로그아웃하면 모든 계정의 녹음을 지운다', () => {
    // Given
    const { files, repository } = createRepository();
    files.addFile(OWNER_DIRECTORY, 'a.wav');

    // When
    repository.removeAll();

    // Then
    expect(files.hasFile(OWNER_DIRECTORY, 'a.wav')).toBe(false);
  });
});
