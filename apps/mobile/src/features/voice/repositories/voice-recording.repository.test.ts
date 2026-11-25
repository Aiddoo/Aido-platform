import { toEpochMs, toInstant } from '@src/shared/date/instant';
import { createLocalFileSystemFake, createAppLoggerStub } from '@src/testing/core';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import { createVoiceRecordingRepository } from './voice-recording.repository';

const NOW = toInstant('2026-12-05T00:00:00.000Z');
const OWNER_DIRECTORY = ['voice-notes', 'user-1'];

function createRepository() {
  const files = createLocalFileSystemFake();
  const logger = createAppLoggerStub();

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

  it('같은 원본을 두 초안이 함께 옮기려 하면 먼저 온 쪽만 옮기고 건너뛴 사실만 남긴다', async () => {
    // Given
    const { files, logger, repository } = createRepository();
    const sourceUri = files.addFile(OWNER_DIRECTORY, 'recording_abc.wav');

    // When
    const [first, second] = await Promise.all([
      repository.save({ accountId: 'user-1', draftId: 'draft-1', partIndex: 0, sourceUri }),
      repository.save({ accountId: 'user-1', draftId: 'draft-2', partIndex: 0, sourceUri }),
    ]);

    // Then
    expect(first).toBe('draft-1-0.wav');
    expect(second).toBeNull();
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-2-0.wav')).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(VOICE_LOG_EVENT.RECORDING_SHARED_SOURCE_SKIPPED);
  });

  it('옮기다 실패한 원본은 기억에 남지 않아 다시 옮길 수 있다', async () => {
    // Given
    const { files, repository } = createRepository();
    const sourceUri = files.addFile(OWNER_DIRECTORY, 'recording_abc.wav');
    files.failNextMove(new Error('ENOSPC'));
    await repository.save({ accountId: 'user-1', draftId: 'draft-1', partIndex: 0, sourceUri });

    // When
    const fileName = await repository.save({
      accountId: 'user-1',
      draftId: 'draft-1',
      partIndex: 0,
      sourceUri,
    });

    // Then
    expect(fileName).toBe('draft-1-0.wav');
  });

  describe('쓰는 중인 원본을 맡은 초안', () => {
    const SOURCE_URI = 'file:///documents/voice-notes/user-1/recording_abc.wav';

    it('먼저 맡은 초안이 주인이고 다른 초안이 뒤에 맡아도 바뀌지 않는다', () => {
      // Given
      const { repository } = createRepository();

      // When
      repository.reserveSource(SOURCE_URI, 'draft-1');
      repository.reserveSource(SOURCE_URI, 'draft-2');

      // Then
      expect(repository.findSourceOwner(SOURCE_URI)).toBe('draft-1');
    });

    it('주인이 놓으면 맡은 곳이 없어지고 주인이 아닌 초안은 놓지 못한다', () => {
      // Given
      const { repository } = createRepository();
      repository.reserveSource(SOURCE_URI, 'draft-1');

      // When
      repository.releaseSource(SOURCE_URI, 'draft-2');

      // Then
      expect(repository.findSourceOwner(SOURCE_URI)).toBe('draft-1');

      // When
      repository.releaseSource(SOURCE_URI, 'draft-1');

      // Then
      expect(repository.findSourceOwner(SOURCE_URI)).toBeNull();
    });

    it('맡은 초안이 옮기는 동안에는 주인으로 남고 옮기기를 마치면 풀린다', async () => {
      // Given
      const { files, repository } = createRepository();
      const sourceUri = files.addFile(OWNER_DIRECTORY, 'recording_abc.wav');
      repository.reserveSource(sourceUri, 'draft-1');

      // When
      const saving = repository.save({
        accountId: 'user-1',
        draftId: 'draft-1',
        partIndex: 0,
        sourceUri,
      });

      // Then
      expect(repository.findSourceOwner(sourceUri)).toBe('draft-1');

      // When
      await saving;

      // Then
      expect(repository.findSourceOwner(sourceUri)).toBeNull();
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
    const old = Date.parse('2026-11-01T00:00:00.000Z');
    files.addFile(OWNER_DIRECTORY, 'orphan-old.wav', { modifiedAtMs: old });
    files.addFile(OWNER_DIRECTORY, 'referenced-old.wav', { modifiedAtMs: old });
    files.addFile(OWNER_DIRECTORY, 'orphan-new.wav', {
      modifiedAtMs: toEpochMs(NOW) - 10 * 60 * 1_000,
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
