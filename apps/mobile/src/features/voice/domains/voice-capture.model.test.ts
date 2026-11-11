import { createCaptureState, createTranscript } from '../__tests__/voice.fixtures';
import { VoiceCapturePolicy, createVoiceCaptureState } from './voice-capture.model';
import { voicePlanSchema } from './voice-plan.model';

const NOW = 100_000;

describe('reduceVoiceCapture', () => {
  const plan = voicePlanSchema.parse({
    planId: 'plan-1',
    source: 'quick-voice',
    sourceMemoId: null,
    actions: [],
    omittedTodoCount: 0,
  });

  it('준비 → 듣기 시작 순서로 진행한다', () => {
    // Given
    const idle = createVoiceCaptureState();

    // When
    const preparing = VoiceCapturePolicy.reduceVoiceCapture(idle, { type: 'prepare' });
    const listening = VoiceCapturePolicy.reduceVoiceCapture(preparing, { type: 'start', at: NOW });

    // Then
    expect(preparing.status).toBe('preparing');
    expect(listening).toMatchObject({ status: 'listening', listeningSince: NOW });
  });

  it('듣는 중 들어온 결과를 글자에 반영한다', () => {
    // Given
    const listening = createCaptureState({ status: 'listening', listeningSince: NOW });

    // When
    const state = VoiceCapturePolicy.reduceVoiceCapture(listening, {
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
    const state = VoiceCapturePolicy.reduceVoiceCapture(listening, {
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
    const state = VoiceCapturePolicy.reduceVoiceCapture(paused, {
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
    const state = VoiceCapturePolicy.reduceVoiceCapture(paused, { type: 'resume' });

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
    const finalizing = VoiceCapturePolicy.reduceVoiceCapture(listening, {
      type: 'finish',
      at: NOW + 3_000,
    });
    const planning = VoiceCapturePolicy.reduceVoiceCapture(finalizing, { type: 'end' });

    // Then
    expect(finalizing).toMatchObject({ status: 'finalizing', elapsedMs: 3_000 });
    expect(planning.status).toBe('planning');
    expect(planning.transcript.sentences).toEqual(['장보기']);
  });

  it('말이 없었으면 서버를 부르지 않고 처음으로 돌아간다', () => {
    // Given
    const finalizing = createCaptureState({ status: 'finalizing' });

    // When
    const state = VoiceCapturePolicy.reduceVoiceCapture(finalizing, { type: 'end' });

    // Then
    expect(state.status).toBe('idle');
  });

  it.each(['no-speech', 'speech-timeout', 'aborted'] as const)(
    '%s 오류는 듣기를 그대로 이어 간다',
    (code) => {
      // Given
      const listening = createCaptureState({ status: 'listening', listeningSince: NOW });

      // When
      const state = VoiceCapturePolicy.reduceVoiceCapture(listening, {
        type: 'error',
        code,
        at: NOW + 1_000,
      });

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
    const state = VoiceCapturePolicy.reduceVoiceCapture(listening, {
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
    const state = VoiceCapturePolicy.reduceVoiceCapture(listening, {
      type: 'error',
      code: 'network',
      at: NOW + 2_000,
    });

    // Then
    expect(state).toMatchObject({ status: 'failed', reason: 'network', elapsedMs: 2_000 });
    expect(state.transcript.sentences).toEqual(['장보기']);
  });

  it('앱이 멈춘 뒤 인식기가 client를 주면 실패로 가지 않고 end에서 듣던 글자까지 확정해 넘긴다', () => {
    // Given
    const finalizing = createCaptureState({
      status: 'finalizing',
      transcript: createTranscript({ interim: '내일 아침 8시에 영양제 먹기' }),
    });

    // When
    const afterError = VoiceCapturePolicy.reduceVoiceCapture(finalizing, {
      type: 'error',
      code: 'client',
      at: NOW,
    });
    const afterEnd = VoiceCapturePolicy.reduceVoiceCapture(afterError, { type: 'end' });

    // Then
    expect(afterError.status).toBe('finalizing');
    expect(afterEnd).toMatchObject({
      status: 'planning',
      transcript: { sentences: ['내일 아침 8시에 영양제 먹기'], interim: '' },
    });
  });

  it('앱이 멈춘 적 없이 듣는 중에 오는 client는 실패다', () => {
    // Given
    const listening = createCaptureState({ status: 'listening', listeningSince: NOW });

    // When
    const state = VoiceCapturePolicy.reduceVoiceCapture(listening, {
      type: 'error',
      code: 'client',
      at: NOW,
    });

    // Then
    expect(state).toMatchObject({ status: 'failed', reason: 'client' });
  });

  it('앱이 구간을 닫으려고 멈춘 뒤 듣는 중이나 준비 중에 오는 client는 실패가 아니다', () => {
    // Given
    const listening = createCaptureState({ status: 'listening', listeningSince: NOW });
    const preparing = createCaptureState({ status: 'preparing' });
    const error = { type: 'error', code: 'client', at: NOW, isStopRequested: true } as const;

    // When
    const states = [
      VoiceCapturePolicy.reduceVoiceCapture(listening, error),
      VoiceCapturePolicy.reduceVoiceCapture(preparing, error),
    ];

    // Then
    expect(states.map(({ status }) => status)).toEqual(['listening', 'preparing']);
  });

  it('계획에 실패해도 글자는 그대로 두고 다시 시도할 수 있다', () => {
    // Given
    const planning = createCaptureState({
      status: 'planning',
      transcript: createTranscript({ sentences: ['장보기'] }),
    });

    // When
    const failed = VoiceCapturePolicy.reduceVoiceCapture(planning, { type: 'plan-failed' });

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
    const state = VoiceCapturePolicy.reduceVoiceCapture(failed, { type: 'retry-plan' });

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
    const planned = VoiceCapturePolicy.reduceVoiceCapture(planning, {
      type: 'planned',
      result: null,
    });
    const cancelled = VoiceCapturePolicy.reduceVoiceCapture(planning, { type: 'cancel' });

    // Then
    expect(planned).toEqual(createVoiceCaptureState());
    expect(cancelled).toEqual(createVoiceCaptureState());
  });

  it('상태에 맞지 않는 이벤트는 무시한다', () => {
    // Given
    const idle = createVoiceCaptureState();

    // When
    const state = VoiceCapturePolicy.reduceVoiceCapture(idle, { type: 'start', at: NOW });

    // Then
    expect(state).toBe(idle);
  });

  it('계획이 오면 들은 글자를 든 채 고르는 단계로 넘어간다', () => {
    // Given
    const transcript = createTranscript({ sentences: ['내일 장보기'] });
    const planning = createCaptureState({ status: 'planning', transcript });

    // When
    const next = VoiceCapturePolicy.reduceVoiceCapture(planning, {
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
    const next = VoiceCapturePolicy.reduceVoiceCapture(planning, {
      type: 'planned',
      result: { plan, isCharged: true },
    });

    // Then
    expect(VoiceCapturePolicy.isActive(next)).toBe(false);
  });

  it('들은 글자가 있으면 실패 상태에서도 여기까지 정리로 넘어간다', () => {
    // Given
    const failed = createCaptureState({
      status: 'failed',
      reason: 'network',
      transcript: createTranscript({ sentences: ['들은 말'] }),
    });

    // When
    const next = VoiceCapturePolicy.reduceVoiceCapture(failed, { type: 'finish', at: 0 });

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
    const next = VoiceCapturePolicy.reduceVoiceCapture(failed, { type: 'finish', at: 0 });

    // Then
    expect(next).toBe(failed);
    expect(VoiceCapturePolicy.canFinish(failed)).toBe(false);
  });

  it('이어 받은 글자와 시간에서 듣기를 시작한다', () => {
    // Given
    const seed = { transcript: createTranscript({ sentences: ['앞 말'] }), elapsedMs: 90_000 };

    // When
    const next = VoiceCapturePolicy.reduceVoiceCapture(createCaptureState({ status: 'idle' }), {
      type: 'prepare',
      seed,
    });

    // Then
    expect(next).toMatchObject({ status: 'preparing', ...seed });
  });

  it('듣는 중에 final 없이 구간이 끝나면 듣던 글자를 확정해 다음 구간이 덮지 못한다', () => {
    // Given
    const state = VoiceCapturePolicy.reduceVoiceCapture(
      VoiceCapturePolicy.reduceVoiceCapture(
        VoiceCapturePolicy.reduceVoiceCapture(createVoiceCaptureState(), {
          type: 'prepare',
        }),
        {
          type: 'start',
          at: 0,
        },
      ),
      { type: 'result', result: { transcript: '앞에서 한 말', isFinal: false } },
    );

    // When
    const ended = VoiceCapturePolicy.reduceVoiceCapture(state, { type: 'end' });
    const next = VoiceCapturePolicy.reduceVoiceCapture(ended, {
      type: 'result',
      result: { transcript: '이어서 한 말', isFinal: false },
    });

    // Then
    expect(ended.status).toBe('listening');
    expect(next.transcript).toEqual({ sentences: ['앞에서 한 말'], interim: '이어서 한 말' });
  });
});

describe('shouldRestartSegment', () => {
  it('듣는 중에 인식기가 끝나면 같은 세션을 다시 연다', () => {
    // Given
    const listening = createCaptureState({ status: 'listening', listeningSince: NOW });
    const paused = createCaptureState({ status: 'paused', cause: 'app-background' });

    // When
    const results = [listening, paused].map(VoiceCapturePolicy.shouldRestartSegment);

    // Then
    expect(results).toEqual([true, false]);
  });
});

describe('canFinish', () => {
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
});

describe('canResume', () => {
  it('권한·언어 문제로 실패하면 이어 듣기를 권하지 않는다', () => {
    // Given
    const denied = createCaptureState({ status: 'failed', reason: 'not-allowed' });
    const offline = createCaptureState({ status: 'failed', reason: 'network' });

    // When
    const results = [denied, offline].map(VoiceCapturePolicy.canResume);

    // Then
    expect(results).toEqual([false, true]);
  });
});

describe('isWrappingUp', () => {
  it('듣기를 마무리하거나 정리하는 중에만 마무리 중으로 본다', () => {
    // Given
    const states = [
      createCaptureState({ status: 'finalizing' }),
      createCaptureState({ status: 'planning' }),
      createCaptureState({ status: 'paused', cause: 'app-background' }),
    ];

    // When
    const results = states.map(VoiceCapturePolicy.isWrappingUp);

    // Then
    expect(results).toEqual([true, true, false]);
  });
});

describe('canResumeWithinLimit', () => {
  it('한 번에 들을 수 있는 길이를 다 썼으면 이어 듣기를 권하지 않는다', () => {
    // Given
    const paused = createCaptureState({ status: 'paused', cause: 'limit', elapsedMs: 180_000 });

    // When
    const results = [180_000, 180_001, null].map((limitMs) =>
      VoiceCapturePolicy.canResumeWithinLimit(paused, limitMs),
    );

    // Then
    expect(results).toEqual([false, true, true]);
  });
});

describe('shouldAutoFinish', () => {
  it('말이 2.5초 멈추고 글자가 있을 때만 자동으로 마무리한다', () => {
    // Given
    const silenceLimitMs = 2_500;
    const spoken = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      transcript: createTranscript({ interim: '장보기' }),
    });
    const empty = createCaptureState({ status: 'listening', listeningSince: NOW });

    // When
    const results = [
      VoiceCapturePolicy.shouldAutoFinish(spoken, 2_499, silenceLimitMs),
      VoiceCapturePolicy.shouldAutoFinish(spoken, 2_500, silenceLimitMs),
      VoiceCapturePolicy.shouldAutoFinish(empty, 5_000, silenceLimitMs),
    ];

    // Then
    expect(results).toEqual([false, true, false]);
  });
});

describe('getDismissAction', () => {
  const createReview = (actions: unknown[]) =>
    VoiceCapturePolicy.reduceVoiceCapture(createCaptureState({ status: 'planning' }), {
      type: 'planned',
      result: {
        plan: voicePlanSchema.parse({
          planId: 'plan-1',
          source: 'quick-voice',
          sourceMemoId: null,
          actions,
          omittedTodoCount: 0,
        }),
        isCharged: true,
      },
    });

  it('듣기·정리는 X와 같은 취소이고, 고를 카드가 있으면 묻고, 잃을 것이 없으면 시트에 맡긴다', () => {
    // Given
    const memoAction = { type: 'create-memo', actionId: 'm1', title: '', content: '내용' };

    // When
    const actions = {
      idle: VoiceCapturePolicy.getDismissAction(createCaptureState({ status: 'idle' })),
      failed: VoiceCapturePolicy.getDismissAction(
        createCaptureState({ status: 'failed', reason: 'planning-failed' }),
      ),
      preparing: VoiceCapturePolicy.getDismissAction(createCaptureState({ status: 'preparing' })),
      listening: VoiceCapturePolicy.getDismissAction(
        createCaptureState({ status: 'listening', listeningSince: NOW }),
      ),
      paused: VoiceCapturePolicy.getDismissAction(
        createCaptureState({ status: 'paused', cause: 'user' }),
      ),
      finalizing: VoiceCapturePolicy.getDismissAction(createCaptureState({ status: 'finalizing' })),
      planning: VoiceCapturePolicy.getDismissAction(createCaptureState({ status: 'planning' })),
      emptyReview: VoiceCapturePolicy.getDismissAction(createReview([])),
      review: VoiceCapturePolicy.getDismissAction(createReview([memoAction])),
    };

    // Then
    expect(actions).toEqual({
      idle: null,
      failed: null,
      preparing: 'cancel-capture',
      listening: 'cancel-capture',
      paused: 'cancel-capture',
      finalizing: 'cancel-capture',
      planning: 'cancel-planning',
      emptyReview: null,
      review: 'confirm-discard',
    });
  });
});

describe('shouldOfferVoiceNote', () => {
  it('90초를 다 써서 멈췄으면 말로 메모하기를 제안한다', () => {
    // Given
    const paused = createCaptureState({ status: 'paused', cause: 'limit', elapsedMs: 90_000 });

    // When
    const offers = VoiceCapturePolicy.shouldOfferVoiceNote(paused, 90);

    // Then
    expect(offers).toBe(true);
  });

  it('앱 이탈로 잠깐 멈춘 것은 제안하지 않는다', () => {
    // Given
    const paused = createCaptureState({
      status: 'paused',
      cause: 'app-background',
      elapsedMs: 30_000,
    });

    // When
    const offers = VoiceCapturePolicy.shouldOfferVoiceNote(paused, 90);

    // Then
    expect(offers).toBe(false);
  });
});

describe('isRecognizerFailure', () => {
  const listening = createCaptureState({ status: 'listening', listeningSince: NOW });

  it.each(['audio-capture', 'busy', 'service-not-allowed', 'unknown', 'client'] as const)(
    '듣는 중의 %s는 앱이 고칠 수 없어 실패로 본다',
    (code) => {
      // When
      const isFailure = VoiceCapturePolicy.isRecognizerFailure(listening, {
        code,
        isStopRequested: false,
      });

      // Then
      expect(isFailure).toBe(true);
    },
  );

  it.each(['no-speech', 'aborted', 'network', 'not-allowed'] as const)(
    '%s는 사용자나 환경 때문이라 실패로 남기지 않는다',
    (code) => {
      // When
      const isFailure = VoiceCapturePolicy.isRecognizerFailure(listening, {
        code,
        isStopRequested: false,
      });

      // Then
      expect(isFailure).toBe(false);
    },
  );

  it('앱이 멈춘 구간의 client는 멈춤 응답이라 실패가 아니다', () => {
    // When
    const isFailure = VoiceCapturePolicy.isRecognizerFailure(listening, {
      code: 'client',
      isStopRequested: true,
    });

    // Then
    expect(isFailure).toBe(false);
  });

  it('앱이 멈춘 뒤 오는 client만 정상 종료로 본다', () => {
    // Given
    const listening = createCaptureState({ status: 'listening', listeningSince: NOW });
    const paused = createCaptureState({ status: 'paused', cause: 'user' });

    // When
    const results = [
      VoiceCapturePolicy.isRecognizerFailure(listening, { code: 'client', isStopRequested: true }),
      VoiceCapturePolicy.isRecognizerFailure(paused, { code: 'client', isStopRequested: false }),
      VoiceCapturePolicy.isRecognizerFailure(listening, { code: 'client', isStopRequested: false }),
      VoiceCapturePolicy.isRecognizerFailure(listening, {
        code: 'audio-capture',
        isStopRequested: true,
      }),
    ];

    // Then
    expect(results).toEqual([false, false, true, true]);
  });
});

describe('getRemainingCaptureMs', () => {
  it('앞서 들은 시간과 지금 구간을 뺀 만큼 남는다', () => {
    // Given
    const state = createCaptureState({
      status: 'listening',
      listeningSince: NOW,
      elapsedMs: 4_000,
    });

    // When
    const remainingMs = VoiceCapturePolicy.getRemainingCaptureMs(state, 10, NOW + 1_000);

    // Then
    expect(remainingMs).toBe(5_000);
  });

  it('한도를 넘겼으면 0이다', () => {
    // Given
    const state = createCaptureState({ status: 'paused', cause: 'limit', elapsedMs: 12_000 });

    // When
    const remainingMs = VoiceCapturePolicy.getRemainingCaptureMs(state, 10, NOW);

    // Then
    expect(remainingMs).toBe(0);
  });
});

describe('isChargedReview', () => {
  const planned = (isCharged: boolean) =>
    VoiceCapturePolicy.reduceVoiceCapture(createCaptureState({ status: 'planning' }), {
      type: 'planned',
      result: {
        plan: voicePlanSchema.parse({
          planId: 'plan-1',
          source: 'quick-voice',
          sourceMemoId: null,
          actions: [],
          omittedTodoCount: 0,
        }),
        isCharged,
      },
    });

  it('횟수를 쓴 고르기 단계만 떠나면 잃는 것이 있다', () => {
    // When
    const results = [
      VoiceCapturePolicy.isChargedReview(planned(true)),
      VoiceCapturePolicy.isChargedReview(planned(false)),
      VoiceCapturePolicy.isChargedReview(createCaptureState({ status: 'planning' })),
    ];

    // Then
    expect(results).toEqual([true, false, false]);
  });
});

describe('isManualInput', () => {
  const plan = voicePlanSchema.parse({
    planId: 'plan-1',
    source: 'quick-voice',
    sourceMemoId: null,
    actions: [],
    omittedTodoCount: 0,
  });

  it.each([
    { input: { status: 'idle' }, expected: true },
    { input: { status: 'failed', reason: 'client' }, expected: true },
    { input: { status: 'preparing' }, expected: false },
    { input: { status: 'listening', listeningSince: NOW }, expected: false },
    { input: { status: 'paused', cause: 'app-background' }, expected: false },
    { input: { status: 'finalizing' }, expected: false },
    { input: { status: 'planning' }, expected: false },
    { input: { status: 'review', plan, isCharged: false }, expected: false },
  ] as const)('$input.status 상태에서 손으로 입력하는지는 $expected다', ({ input, expected }) => {
    // Given
    const state = createCaptureState(input);

    // When
    const result = VoiceCapturePolicy.isManualInput(state);

    // Then
    expect(result).toBe(expected);
  });
});

describe('getElapsedMs', () => {
  it('듣는 중이면 앞서 들은 시간에 이번 구간에 지난 시간을 더한다', () => {
    // Given
    const state = createCaptureState({
      status: 'listening',
      elapsedMs: 3_000,
      listeningSince: NOW - 2_500,
    });

    // When
    const elapsedMs = VoiceCapturePolicy.getElapsedMs(state, NOW);

    // Then
    // 3,000 + (100,000 - 97,500) = 5,500
    expect(elapsedMs).toBe(5_500);
  });

  it('듣기 시작한 순간이면 앞서 들은 시간만이다', () => {
    // Given
    const state = createCaptureState({
      status: 'listening',
      elapsedMs: 3_000,
      listeningSince: NOW,
    });

    // When
    const elapsedMs = VoiceCapturePolicy.getElapsedMs(state, NOW);

    // Then
    expect(elapsedMs).toBe(3_000);
  });

  it('기기 시계가 시작보다 앞서도 시간을 빼지 않는다', () => {
    // Given
    const state = createCaptureState({
      status: 'listening',
      elapsedMs: 3_000,
      listeningSince: NOW + 1_000,
    });

    // When
    const elapsedMs = VoiceCapturePolicy.getElapsedMs(state, NOW);

    // Then
    // 3,000 + max(0, -1,000) = 3,000
    expect(elapsedMs).toBe(3_000);
  });

  it('멈춘 상태는 시간이 흘러도 저장한 시간 그대로다', () => {
    // Given
    const state = createCaptureState({ status: 'paused', cause: 'user', elapsedMs: 7_000 });

    // When
    const elapsedMs = VoiceCapturePolicy.getElapsedMs(state, NOW + 60_000);

    // Then
    expect(elapsedMs).toBe(7_000);
  });
});
