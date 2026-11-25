import { createSignOutEpoch } from '@src/core/session/sign-out-epoch';
import {
  createLocalFileSystemFake,
  createSpeechRecognizerStub,
  createTestDi,
  createVoiceNoteStorageFake,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { createSpokenVoiceNote } from '../__tests__/voice-note.fixtures';
import { VoiceRecordingIntakeSession } from './voice-recording-intake.session';

const ACCOUNT_ID = 'user-1';
const DRAFT_ID = 'draft-1';
const DIRECTORY = ['voice-notes', ACCOUNT_ID];

function createIntake() {
  const files = createLocalFileSystemFake();
  const di = createTestDi({ ports: createVoiceNoteStorageFake(files).ports });
  const onRecordingSaved = jest.fn();
  const signOutEpoch = createSignOutEpoch();
  const intake = new VoiceRecordingIntakeSession({
    accountId: ACCOUNT_ID,
    draftId: DRAFT_ID,
    draftRepository: di.voiceNoteDraftRepository,
    recordingRepository: di.voiceRecordingRepository,
    discard: di.voiceNoteStorageService.discard,
    signOutEpoch,
    onRecordingSaved,
  });
  return { files, di, intake, onRecordingSaved, signOutEpoch };
}

describe('VoiceRecordingIntakeSession', () => {
  setupFakeTimersPerTest();

  it('기다릴 파일이 없으면 바로 끝난다', async () => {
    // Given
    const { intake } = createIntake();

    // When
    const settled = intake.waitUntilSettled();

    // Then
    await expect(settled).resolves.toBeUndefined();
  });

  it('파일이 오지 않으면 3초만 기다린다', async () => {
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

  it('파일이 뒤바뀌어 와도 구간 시작 시각 순서로 저장하고 옮길 때마다 알린다', async () => {
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

  it('넘긴 뒤에 온 파일은 저장된 초안에 더한다', async () => {
    // Given
    const { files, di, intake } = createIntake();
    const uri = files.addFile(DIRECTORY, 'a.wav');
    intake.segmentStarted(uri, 0);
    di.voiceNoteDraftRepository.save(
      ACCOUNT_ID,
      createSpokenVoiceNote({ draftId: DRAFT_ID, recordings: [] }),
    );
    intake.handOff();

    // When
    intake.receive(uri, 0);
    await intake.waitUntilSettled();

    // Then
    expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.recordings).toHaveLength(1);
  });

  it('지운 뒤에 온 파일은 옮기지 않고 바로 지운다', () => {
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

  it('넘긴 뒤 툴바에서 메모를 지웠으면 늦게 온 파일도 기기에 남기지 않는다', async () => {
    // Given
    const { files, di, intake } = createIntake();
    const uri = files.addFile(DIRECTORY, 'a.wav');
    intake.segmentStarted(uri, 0);
    di.voiceNoteDraftRepository.save(
      ACCOUNT_ID,
      createSpokenVoiceNote({ draftId: DRAFT_ID, recordings: [] }),
    );
    intake.handOff();
    di.voiceNoteStorageService.discard(ACCOUNT_ID, DRAFT_ID);

    // When
    intake.receive(uri, 0);
    await intake.waitUntilSettled();

    // Then
    expect(files.listFiles(DIRECTORY)).toEqual([]);
  });

  it('늦은 파일은 자기 파일만 받고 다 받으면 구독을 푼다', async () => {
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

  it('늦은 파일이 끝내 오지 않으면 30초 뒤 구독을 푼다', () => {
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

  it('늦은 파일 듣기를 다시 걸면 앞의 구독을 풀어 하나만 남긴다', () => {
    // Given
    const { intake } = createIntake();
    const speechRecognizer = createSpeechRecognizerStub();
    intake.segmentStarted('file:///documents/voice-notes/user-1/a.wav', 0);

    // When
    intake.listenForLate((listener) => speechRecognizer.subscribe(listener));
    intake.listenForLate((listener) => speechRecognizer.subscribe(listener));

    // Then
    expect(speechRecognizer.getListenerCount()).toBe(1);

    // When
    jest.advanceTimersByTime(30_000);

    // Then
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });

  it('기다릴 파일이 없으면 늦은 파일을 듣지 않는다', () => {
    // Given
    const { intake } = createIntake();
    const speechRecognizer = createSpeechRecognizerStub();

    // When
    intake.listenForLate((listener) => speechRecognizer.subscribe(listener));

    // Then
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });

  it('로그아웃하면 늦은 파일 듣기를 멈추고, 그 뒤 온 파일은 이전 계정 초안·녹음으로 옮기지 않고 지운다', async () => {
    // Given
    const { files, intake, signOutEpoch, onRecordingSaved } = createIntake();
    const uri = files.addFile(DIRECTORY, 'a.wav');
    const speechRecognizer = createSpeechRecognizerStub();
    intake.segmentStarted(uri, 0);
    intake.listenForLate((listener) => speechRecognizer.subscribe(listener));

    // When
    signOutEpoch.advance();

    // Then
    expect(speechRecognizer.getListenerCount()).toBe(0);
    expect(intake.canWriteDraft()).toBe(false);

    // When
    intake.receive(uri, 0);
    await intake.waitUntilSettled();

    // Then
    expect(files.hasFile(DIRECTORY, 'a.wav')).toBe(false);
    expect(intake.getRecordings()).toEqual([]);
    expect(onRecordingSaved).not.toHaveBeenCalled();
  });

  it('끝내면 늦은 파일 구독과 기다림 타이머를 지우고 여러 번 불러도 같다', async () => {
    // Given
    const { intake } = createIntake();
    const speechRecognizer = createSpeechRecognizerStub();
    intake.segmentStarted('file:///documents/voice-notes/user-1/a.wav', 0);
    intake.listenForLate((listener) => speechRecognizer.subscribe(listener));
    const settled = intake.waitUntilSettled();

    // When
    intake.dispose();
    intake.dispose();

    // Then
    await expect(settled).resolves.toBeUndefined();
    expect(speechRecognizer.getListenerCount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('끝낸 뒤에도 화면이 다시 받은 파일은 전과 같이 옮겨 저장한다', async () => {
    // Given
    const { files, intake, onRecordingSaved } = createIntake();
    const uri = files.addFile(DIRECTORY, 'a.wav');
    intake.segmentStarted(uri, 0);
    intake.dispose();

    // When
    intake.receive(uri, 0);
    await intake.waitUntilSettled();

    // Then
    expect(intake.getRecordings()).toHaveLength(1);
    expect(onRecordingSaved).toHaveBeenCalledTimes(1);
  });

  it('끝낸 뒤라도 지운 초안의 파일은 전과 같이 옮기지 않고 지운다', async () => {
    // Given
    const { files, intake, onRecordingSaved } = createIntake();
    const uri = files.addFile(DIRECTORY, 'a.wav');
    intake.segmentStarted(uri, 0);
    intake.dispose();
    intake.discard();

    // When
    intake.receive(uri, 0);
    await intake.waitUntilSettled();

    // Then
    expect(files.hasFile(DIRECTORY, 'a.wav')).toBe(false);
    expect(intake.getRecordings()).toEqual([]);
    expect(onRecordingSaved).not.toHaveBeenCalled();
  });

  describe('화면이 인식기를 다시 듣기 시작하면', () => {
    it('같은 인식기에 걸어 둔 늦은 파일 듣기를 거둬 화면이 넘긴 파일을 한 번만 옮긴다', async () => {
      // Given
      const { files, intake, onRecordingSaved } = createIntake();
      const speechRecognizer = createSpeechRecognizerStub();
      const uri = files.addFile(DIRECTORY, 'a.wav');
      intake.segmentStarted(uri, 0);
      intake.listenForLate(speechRecognizer.subscribe);

      // When
      intake.reclaim(speechRecognizer.subscribe);
      speechRecognizer.emit({ type: 'recording-saved', uri });
      intake.receive(uri, 0);
      await intake.waitUntilSettled();

      // Then
      expect(speechRecognizer.getListenerCount()).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
      expect(intake.getRecordings()).toHaveLength(1);
      expect(onRecordingSaved).toHaveBeenCalledTimes(1);
    });

    it('인식기가 바뀌었으면 옛 인식기의 늦은 파일 듣기를 그대로 둬 그 파일을 잃지 않는다', async () => {
      // Given
      const { files, intake } = createIntake();
      const previousRecognizer = createSpeechRecognizerStub();
      const nextRecognizer = createSpeechRecognizerStub();
      const uri = files.addFile(DIRECTORY, 'a.wav');
      intake.segmentStarted(uri, 0);
      intake.listenForLate(previousRecognizer.subscribe);

      // When
      intake.reclaim(nextRecognizer.subscribe);
      previousRecognizer.emit({ type: 'recording-saved', uri });
      await intake.waitUntilSettled();

      // Then
      expect(intake.getRecordings()).toHaveLength(1);
      expect(previousRecognizer.getListenerCount()).toBe(0);
    });
  });
});
