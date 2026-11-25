import type { SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { createSpeechRecognizerStub } from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { createCaptureState } from '../__tests__/voice.fixtures';
import { RECOGNIZER_END_TIMEOUT_MS } from '../constants/voice.constants';
import { VoiceCapturePolicy, type VoiceCaptureState } from '../domains/voice-capture.model';
import { VoiceRecognizerSession } from './voice-recognizer.session';

const START_OPTIONS: SpeechStartOptions = {
  locale: 'ko-KR',
  mode: 'note',
  hintWords: [],
  isOnDevice: true,
  recordingDirectory: null,
};
const PREPARING = createCaptureState({ status: 'preparing' });
const LISTENING = createCaptureState({ status: 'listening', listeningSince: 0 });
const FINALIZING = createCaptureState({ status: 'finalizing' });
const IDLE = createCaptureState({ status: 'idle' });

function createSession(initial: VoiceCaptureState) {
  const speechRecognizer = createSpeechRecognizerStub();
  const capture = { state: initial };
  const session = new VoiceRecognizerSession({
    speechRecognizer,
    isAwaitingStart: () => VoiceCapturePolicy.isAwaitingStart(capture.state),
    isListening: () => VoiceCapturePolicy.shouldRestartSegment(capture.state),
    isActive: () => VoiceCapturePolicy.isActive(capture.state),
  });
  session.setStartOptions(START_OPTIONS);
  return { speechRecognizer, capture, session };
}

describe('VoiceRecognizerSession', () => {
  setupFakeTimersPerTest({ now: 0 });

  describe('앞 구간이 끝난 뒤에 열기', () => {
    it('도는 구간이 없으면 바로 연다', () => {
      // Given
      const { speechRecognizer, session } = createSession(PREPARING);

      // When
      session.startAfterEnd();

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(1);
      expect(session.hasDeferredStart()).toBe(false);
    });

    it('앞 구간이 돌고 있으면 미뤄 두고 end가 오지 않아도 잠시 뒤 연다', () => {
      // Given
      const { speechRecognizer, session } = createSession(PREPARING);
      session.startAfterEnd();

      // When
      session.startAfterEnd();

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(1);
      expect(session.hasDeferredStart()).toBe(true);

      // When
      jest.advanceTimersByTime(RECOGNIZER_END_TIMEOUT_MS);

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
      expect(session.hasDeferredStart()).toBe(false);
    });

    it('기다리는 사이 준비를 그만뒀으면 열지 않는다', () => {
      // Given
      const { speechRecognizer, capture, session } = createSession(PREPARING);
      session.startAfterEnd();
      session.startAfterEnd();
      capture.state = IDLE;

      // When
      jest.advanceTimersByTime(RECOGNIZER_END_TIMEOUT_MS);

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('끝난 구간 다시 열기', () => {
    it('정한 옵션이 없으면 열지 못했다고 알려 부른 쪽이 듣는 중으로 남기지 않게 한다', () => {
      // Given
      const { speechRecognizer, session } = createSession(LISTENING);
      session.setStartOptions(null);

      // When
      const hasRestarted = session.restartSegment();

      // Then
      expect(hasRestarted).toBe(false);
      expect(speechRecognizer.start).not.toHaveBeenCalled();
    });

    it('옵션이 있으면 같은 옵션으로 다시 연다', () => {
      // Given
      const { speechRecognizer, session } = createSession(LISTENING);

      // When
      const hasRestarted = session.restartSegment();

      // Then
      expect(hasRestarted).toBe(true);
      expect(speechRecognizer.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('닫은 구간의 end 기다리기', () => {
    it('end가 오면 답이 없을 때의 알림을 부르지 않는다', () => {
      // Given
      const { speechRecognizer, session } = createSession(FINALIZING);
      const onUnanswered = jest.fn();
      session.stopAndAwaitEnd(onUnanswered);

      // When
      session.noteEnded();
      jest.advanceTimersByTime(RECOGNIZER_END_TIMEOUT_MS);

      // Then
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
      expect(onUnanswered).not.toHaveBeenCalled();
    });

    it('end가 오지 않으면 잠시 뒤 한 번 알린다', () => {
      // Given
      const { session } = createSession(FINALIZING);
      const onUnanswered = jest.fn();
      session.stopAndAwaitEnd(onUnanswered);

      // When
      jest.advanceTimersByTime(RECOGNIZER_END_TIMEOUT_MS * 2);

      // Then
      expect(onUnanswered).toHaveBeenCalledTimes(1);
    });
  });

  describe('멈춘 구간 닫기', () => {
    it.each([
      { why: '듣는 중에 stop의 답이 없으면', state: LISTENING, hasEnded: false, abortCount: 1 },
      { why: 'end가 먼저 오면', state: LISTENING, hasEnded: true, abortCount: 0 },
      { why: '그 사이 끝내는 중이 됐으면', state: FINALIZING, hasEnded: false, abortCount: 0 },
    ])('$why abort를 $abortCount번 보낸다', ({ state, hasEnded, abortCount }) => {
      // Given
      const { speechRecognizer, capture, session } = createSession(LISTENING);
      session.closeStalledSegment(0);
      capture.state = state;
      if (hasEnded) {
        session.noteEnded();
      }

      // When
      jest.advanceTimersByTime(RECOGNIZER_END_TIMEOUT_MS);

      // Then
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
      expect(speechRecognizer.abort).toHaveBeenCalledTimes(abortCount);
    });
  });

  describe('놓기', () => {
    it('듣던 구간이 있으면 끊고 남은 타이머를 지운다', () => {
      // Given
      const { speechRecognizer, session } = createSession(FINALIZING);
      const onUnanswered = jest.fn();
      session.stopAndAwaitEnd(onUnanswered);

      // When
      session.dispose();
      jest.advanceTimersByTime(RECOGNIZER_END_TIMEOUT_MS);

      // Then
      expect(speechRecognizer.abort).toHaveBeenCalledTimes(1);
      expect(onUnanswered).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('듣지 않을 때는 다른 세션이 쓰는 인식기를 끊지 않는다', () => {
      // Given
      const { speechRecognizer, session } = createSession(IDLE);

      // When
      session.dispose();

      // Then
      expect(speechRecognizer.abort).not.toHaveBeenCalled();
    });

    it('놓은 뒤 다시 붙은 훅이 불러도 정해 둔 옵션으로 연다', () => {
      // Given
      const { speechRecognizer, capture, session } = createSession(IDLE);
      session.dispose();
      capture.state = PREPARING;

      // When
      session.startAfterEnd();

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'ko-KR', mode: 'note' }),
      );
    });
  });
});
