import {
  createLocalFileSystemFake,
  createSpeechRecognizerStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';

import { createVoiceNoteFixture } from '../__tests__/voice-note.factories';
import { VoiceRecordingIntake } from './voice-recording-intake';

const ACCOUNT_ID = 'user-1';
const DRAFT_ID = 'draft-1';
const DIRECTORY = ['voice-notes', ACCOUNT_ID];

function createIntake() {
  const files = createLocalFileSystemFake();
  const storage = createVoiceNoteStorageServiceFake(files);
  const onRecordingSaved = jest.fn();
  const intake = new VoiceRecordingIntake({
    accountId: ACCOUNT_ID,
    draftId: DRAFT_ID,
    storage,
    onRecordingSaved,
  });
  return { files, storage, intake, onRecordingSaved };
}

describe('VoiceRecordingIntake', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('기다릴 파일이 없으면 바로 끝난다', async () => {
    // Given
    const { intake } = createIntake();

    // When
    const settled = intake.waitUntilSettled();

    // Then
    await expect(settled).resolves.toBeUndefined();
  });

  test('파일이 오지 않으면 3초만 기다린다', async () => {
    // Given
    const { intake } = createIntake();
    intake.segmentStarted('file:///documents/voice-notes/user-1/a.wav', 0);
    const onSettled = jest.fn();

    // When
    intake.waitUntilSettled().then(onSettled, onSettled);
    await jest.advanceTimersByTimeAsync(2_900);

    // Then
    expect(onSettled).not.toHaveBeenCalled();

    // When
    await jest.advanceTimersByTimeAsync(200);

    // Then
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  test('파일이 뒤바뀌어 와도 구간 시작 시각 순서로 저장하고 옮길 때마다 알린다', async () => {
    // Given
    const { files, intake, onRecordingSaved } = createIntake();
    const first = files.addFile(DIRECTORY, 'a.wav');
    const second = files.addFile(DIRECTORY, 'b.wav');
    intake.segmentStarted(first, 0);
    intake.segmentStarted(second, 5_000);

    // When
    intake.receive(second, 0);
    intake.receive(first, 0);
    await intake.waitUntilSettled();

    // Then
    expect(intake.getRecordings().map(({ startMs }) => startMs)).toEqual([0, 5_000]);
    expect(onRecordingSaved).toHaveBeenCalledTimes(2);
  });

  test('넘긴 뒤에 온 파일은 저장된 초안에 더한다', async () => {
    // Given
    const { files, storage, intake } = createIntake();
    const uri = files.addFile(DIRECTORY, 'a.wav');
    intake.segmentStarted(uri, 0);
    storage.drafts.save(ACCOUNT_ID, createVoiceNoteFixture({ draftId: DRAFT_ID, recordings: [] }));
    intake.handOff();

    // When
    intake.receive(uri, 0);
    await intake.waitUntilSettled();

    // Then
    expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.recordings).toHaveLength(1);
  });

  test('지운 뒤에 온 파일은 옮기지 않고 바로 지운다', () => {
    // Given
    const { files, intake } = createIntake();
    const uri = files.addFile(DIRECTORY, 'a.wav');
    intake.segmentStarted(uri, 0);
    intake.discard();

    // When
    intake.receive(uri, 0);

    // Then
    expect(files.hasFile(DIRECTORY, 'a.wav')).toBe(false);
  });

  test('늦은 파일은 자기 파일만 받고 다 받으면 구독을 푼다', async () => {
    // Given
    const { files, intake } = createIntake();
    const uri = files.addFile(DIRECTORY, 'a.wav');
    const otherUri = files.addFile(DIRECTORY, 'other.wav');
    const speechRecognizer = createSpeechRecognizerStub();
    intake.segmentStarted(uri, 0);
    intake.listenForLate((listener) => speechRecognizer.subscribe(listener));

    // When
    speechRecognizer.emit({ type: 'recording-saved', uri: otherUri });

    // Then
    expect(files.hasFile(DIRECTORY, 'other.wav')).toBe(true);
    expect(speechRecognizer.getListenerCount()).toBe(1);

    // When
    speechRecognizer.emit({ type: 'recording-saved', uri });
    await intake.waitUntilSettled();

    // Then
    expect(intake.getRecordings()).toHaveLength(1);
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });

  test('늦은 파일이 끝내 오지 않으면 30초 뒤 구독을 푼다', () => {
    // Given
    const { intake } = createIntake();
    const speechRecognizer = createSpeechRecognizerStub();
    intake.segmentStarted('file:///documents/voice-notes/user-1/a.wav', 0);
    intake.listenForLate((listener) => speechRecognizer.subscribe(listener));

    // When
    jest.advanceTimersByTime(30_000);

    // Then
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });

  test('기다릴 파일이 없으면 늦은 파일을 듣지 않는다', () => {
    // Given
    const { intake } = createIntake();
    const speechRecognizer = createSpeechRecognizerStub();

    // When
    intake.listenForLate((listener) => speechRecognizer.subscribe(listener));

    // Then
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });
});
