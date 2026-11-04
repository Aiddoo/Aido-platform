import { createCaptureState, createTranscript } from '../__tests__/voice.factories';
import {
  createVoiceCaptureState,
  reduceVoiceCapture,
  VoiceCapturePolicy,
} from './voice-capture.model';
import { voicePlanSchema } from './voice-plan.model';

const NOW = 100_000;

describe('reduceVoiceCapture', () => {
  it('준비 → 듣기 시작 순서로 진행한다', () => {
    // Given
    const idle = createVoiceCaptureState();

    // When
    const preparing = reduceVoiceCapture(idle, { type: 'prepare' });
    const listening = reduceVoiceCapture(preparing, { type: 'start', at: NOW });

    // Then
    expect(preparing.status).toBe('preparing');
    expect(listening).toMatchObject({ status: 'listening', listeningSince: NOW });
  });

  it('듣는 중 들어온 결과를 글자에 반영한다', () => {
    // Given
    const listening = createCaptureState({ status: 'listening', listeningSince: NOW });

    // When
    const state = reduceVoiceCapture(listening, {
      type: 'result',
      result: { transcript: '장보기', isFinal: false },
    });

    // Then
    expect(state.transcript.interim).toBe('장보기');
  });

  it('앱을 벗어나면 일시정지하고 지금까지 들은 시간과 글자를 보존한다', () => {
    // Given
    const listening = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      transcript: createTranscript({ sentences: ['장보기'] }),
    });

    // When
    const state = reduceVoiceCapture(listening, {
      type: 'pause',
      cause: 'app-background',
      at: NOW + 4_000,
    });

    // Then
    expect(state).toMatchObject({
      status: 'paused',
      cause: 'app-background',
      elapsedMs: 4_000,
      pauseCount: 1,
    });
    expect(state.transcript.sentences).toEqual(['장보기']);
  });

  it('일시정지 중 늦게 도착한 마지막 결과도 받는다', () => {
    // Given
    const paused = createCaptureState({ status: 'paused', cause: 'app-background' });

    // When
    const state = reduceVoiceCapture(paused, {
      type: 'result',
      result: { transcript: '우유', isFinal: true },
    });

    // Then
    expect(state.transcript.sentences).toEqual(['우유']);
  });

  it('이어 듣기를 하면 남은 꼬리를 확정하고 준비 상태로 돌아간다', () => {
    // Given
    const paused = createCaptureState({
      status: 'paused',
      cause: 'interrupted',
      elapsedMs: 4_000,
      transcript: createTranscript({ interim: '우유' }),
    });

    // When
    const state = reduceVoiceCapture(paused, { type: 'resume' });

    // Then
    expect(state).toMatchObject({ status: 'preparing', elapsedMs: 4_000 });
    expect(state.transcript).toEqual({ sentences: ['우유'], interim: '' });
  });

  it('다 말했어요를 누르면 마무리 중이 되고 끝 이벤트에서 계획 중으로 넘어간다', () => {
    // Given
    const listening = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      transcript: createTranscript({ interim: '장보기' }),
    });

    // When
    const finalizing = reduceVoiceCapture(listening, { type: 'finish', at: NOW + 3_000 });
    const planning = reduceVoiceCapture(finalizing, { type: 'end' });

    // Then
    expect(finalizing).toMatchObject({ status: 'finalizing', elapsedMs: 3_000 });
    expect(planning.status).toBe('planning');
    expect(planning.transcript.sentences).toEqual(['장보기']);
  });

  it('말이 없었으면 서버를 부르지 않고 처음으로 돌아간다', () => {
    // Given
    const finalizing = createCaptureState({ status: 'finalizing' });

    // When
    const state = reduceVoiceCapture(finalizing, { type: 'end' });

    // Then
    expect(state.status).toBe('idle');
  });

  it.each(['no-speech', 'speech-timeout', 'aborted'] as const)(
    '%s 오류는 듣기를 그대로 이어 간다',
    (code) => {
      // Given
      const listening = createCaptureState({ status: 'listening', listeningSince: NOW });

      // When
      const state = reduceVoiceCapture(listening, { type: 'error', code, at: NOW + 1_000 });

      // Then
      expect(state).toBe(listening);
    },
  );

  it('전화 같은 끼어들기는 일시정지로 두고 글자를 지킨다', () => {
    // Given
    const listening = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      transcript: createTranscript({ sentences: ['장보기'] }),
    });

    // When
    const state = reduceVoiceCapture(listening, {
      type: 'error',
      code: 'interrupted',
      at: NOW + 2_000,
    });

    // Then
    expect(state).toMatchObject({ status: 'paused', cause: 'interrupted' });
    expect(state.transcript.sentences).toEqual(['장보기']);
  });

  it('복구할 수 없는 오류는 실패로 두되 들은 글자를 확정해 남긴다', () => {
    // Given
    const listening = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      transcript: createTranscript({ interim: '장보기' }),
    });

    // When
    const state = reduceVoiceCapture(listening, {
      type: 'error',
      code: 'network',
      at: NOW + 2_000,
    });

    // Then
    expect(state).toMatchObject({ status: 'failed', reason: 'network', elapsedMs: 2_000 });
    expect(state.transcript.sentences).toEqual(['장보기']);
  });

  it('계획에 실패해도 글자는 그대로 두고 다시 시도할 수 있다', () => {
    // Given
    const planning = createCaptureState({
      status: 'planning',
      transcript: createTranscript({ sentences: ['장보기'] }),
    });

    // When
    const failed = reduceVoiceCapture(planning, { type: 'plan-failed' });

    // Then
    expect(failed).toMatchObject({ status: 'failed', reason: 'planning-failed' });
    expect(VoiceCapturePolicy.canRetryPlanning(failed)).toBe(true);
    expect(VoiceCapturePolicy.canResume(failed)).toBe(false);
  });

  it('계획 실패 뒤 다시 시도하면 같은 글자로 계획 중이 된다', () => {
    // Given
    const failed = createCaptureState({
      status: 'failed',
      reason: 'planning-failed',
      transcript: createTranscript({ sentences: ['장보기'] }),
    });

    // When
    const state = reduceVoiceCapture(failed, { type: 'retry-plan' });

    // Then
    expect(state.status).toBe('planning');
    expect(state.transcript.sentences).toEqual(['장보기']);
  });

  it('계획이 끝나면 처음 상태로 돌아가고 취소하면 글자도 비운다', () => {
    // Given
    const planning = createCaptureState({
      status: 'planning',
      transcript: createTranscript({ sentences: ['장보기'] }),
    });

    // When
    const planned = reduceVoiceCapture(planning, { type: 'planned', result: null });
    const cancelled = reduceVoiceCapture(planning, { type: 'cancel' });

    // Then
    expect(planned).toEqual(createVoiceCaptureState());
    expect(cancelled).toEqual(createVoiceCaptureState());
  });

  it('상태에 맞지 않는 이벤트는 무시한다', () => {
    // Given
    const idle = createVoiceCaptureState();

    // When
    const state = reduceVoiceCapture(idle, { type: 'start', at: NOW });

    // Then
    expect(state).toBe(idle);
  });
});

describe('VoiceCapturePolicy', () => {
  it('듣는 중에 인식기가 끝나면 같은 세션을 다시 연다', () => {
    // Given
    const listening = createCaptureState({ status: 'listening', listeningSince: NOW });
    const paused = createCaptureState({ status: 'paused', cause: 'app-background' });

    // When
    const results = [listening, paused].map(VoiceCapturePolicy.shouldRestartSegment);

    // Then
    expect(results).toEqual([true, false]);
  });

  it('글자가 있을 때만 끝낼 수 있다', () => {
    // Given
    const empty = createCaptureState({ status: 'listening', listeningSince: NOW });
    const spoken = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      transcript: createTranscript({ interim: '장보기' }),
    });

    // When
    const results = [empty, spoken].map(VoiceCapturePolicy.canFinish);

    // Then
    expect(results).toEqual([false, true]);
  });

  it('권한·언어 문제로 실패하면 이어 듣기를 권하지 않는다', () => {
    // Given
    const denied = createCaptureState({ status: 'failed', reason: 'not-allowed' });
    const offline = createCaptureState({ status: 'failed', reason: 'network' });

    // When
    const results = [denied, offline].map(VoiceCapturePolicy.canResume);

    // Then
    expect(results).toEqual([false, true]);
  });

  it('말이 2.5초 멈추고 글자가 있을 때만 자동으로 마무리한다', () => {
    // Given
    const spoken = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      transcript: createTranscript({ interim: '장보기' }),
    });
    const empty = createCaptureState({ status: 'listening', listeningSince: NOW });

    // When
    const results = [
      VoiceCapturePolicy.shouldAutoFinish(spoken, 2_499),
      VoiceCapturePolicy.shouldAutoFinish(spoken, 2_500),
      VoiceCapturePolicy.shouldAutoFinish(empty, 5_000),
    ];

    // Then
    expect(results).toEqual([false, true, false]);
  });

  it('일시정지 구간을 제외한 시간으로 90초 제한과 남은 시간을 계산한다', () => {
    // Given
    const listening = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      elapsedMs: 60_000,
    });

    // When
    const at29s = VoiceCapturePolicy.isOverQuickLimit(listening, NOW + 29_999);
    const at30s = VoiceCapturePolicy.isOverQuickLimit(listening, NOW + 30_000);
    const remaining = VoiceCapturePolicy.getRemainingSeconds(listening, 90, NOW + 10_500);

    // Then
    expect([at29s, at30s]).toEqual([false, true]);
    expect(remaining).toBe(20);
  });

  describe('계획 받기', () => {
    const plan = voicePlanSchema.parse({
      planId: 'plan-1',
      source: 'quick-voice',
      sourceMemoId: null,
      actions: [],
      omittedTodoCount: 0,
    });

    it('계획이 오면 들은 글자를 든 채 고르는 단계로 넘어간다', () => {
      // Given
      const transcript = createTranscript({ sentences: ['내일 장보기'] });
      const planning = createCaptureState({ status: 'planning', transcript });

      // When
      const next = reduceVoiceCapture(planning, {
        type: 'planned',
        result: { plan, isCharged: false },
      });

      // Then
      expect(next).toMatchObject({ status: 'review', plan, isCharged: false, transcript });
    });

    it('고르는 단계는 듣는 중이 아니라 닫을 때 인식기를 끊지 않는다', () => {
      // Given
      const planning = createCaptureState({ status: 'planning' });

      // When
      const next = reduceVoiceCapture(planning, {
        type: 'planned',
        result: { plan, isCharged: true },
      });

      // Then
      expect(VoiceCapturePolicy.isActive(next)).toBe(false);
    });
  });

  describe('인식 실패 뒤 끝내기', () => {
    it('들은 글자가 있으면 실패 상태에서도 여기까지 정리로 넘어간다', () => {
      // Given
      const failed = createCaptureState({
        status: 'failed',
        reason: 'network',
        transcript: createTranscript({ sentences: ['들은 말'] }),
      });

      // When
      const next = reduceVoiceCapture(failed, { type: 'finish', at: 0 });

      // Then
      expect(next.status).toBe('planning');
      expect(VoiceCapturePolicy.canFinish(failed)).toBe(true);
    });

    it('계획 실패는 끝내기가 아니라 다시 정리로만 이어진다', () => {
      // Given
      const failed = createCaptureState({
        status: 'failed',
        reason: 'planning-failed',
        transcript: createTranscript({ sentences: ['들은 말'] }),
      });

      // When
      const next = reduceVoiceCapture(failed, { type: 'finish', at: 0 });

      // Then
      expect(next).toBe(failed);
      expect(VoiceCapturePolicy.canFinish(failed)).toBe(false);
    });
  });
});
