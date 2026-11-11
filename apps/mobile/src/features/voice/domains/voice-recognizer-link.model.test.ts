import { createCaptureState } from '../__tests__/voice.fixtures';
import { SPEAKING_VOLUME_THRESHOLD } from '../constants/voice.constants';
import { type VoiceStallWatch, VoiceRecognizerLinkPolicy } from './voice-recognizer-link.model';

const NOW = 100_000;

describe('shouldRestartStalledRecognizer', () => {
  const listening = createCaptureState({ status: 'listening', listeningSince: NOW });
  const watch = (overrides: Partial<VoiceStallWatch> = {}): VoiceStallWatch => ({
    ...VoiceRecognizerLinkPolicy.createVoiceStallWatch(NOW),
    voicedMs: 3_000,
    isVoiceAudible: true,
    ...overrides,
  });

  it.each([
    { why: '글자 없이 6초가 지나고 3초 넘게 들었다', at: 6_000, overrides: {}, expected: true },
    { why: '글자가 온 지 6초가 안 됐다', at: 5_999, overrides: {}, expected: false },
    {
      why: '들은 시간이 3초가 안 된다',
      at: 6_000,
      overrides: { voicedMs: 2_999 },
      expected: false,
    },
    { why: '지금은 조용하다', at: 60_000, overrides: { isVoiceAudible: false }, expected: false },
    {
      why: '글자 없이 다시 연 지 30초가 안 됐다',
      at: 29_999,
      overrides: { lastRestartAt: NOW },
      expected: false,
    },
    {
      why: '글자 없이 다시 연 지 30초가 지났다',
      at: 30_000,
      overrides: { lastRestartAt: NOW },
      expected: true,
    },
  ])('$why → $expected', ({ at, overrides, expected }) => {
    // Given
    const link = {
      ...VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
      isStopRequested: false,
      stallWatch: watch(overrides),
    };

    // When
    const result = VoiceRecognizerLinkPolicy.shouldRestartStalledRecognizer(
      link,
      listening,
      NOW + at,
    );

    // Then
    expect(result).toBe(expected);
  });

  it('앱이 이미 stop을 부른 구간은 멈춘 것처럼 보여도 다시 열지 않는다', () => {
    // Given
    const link = {
      ...VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
      isStopRequested: true,
      stallWatch: watch(),
    };

    // When
    const result = VoiceRecognizerLinkPolicy.shouldRestartStalledRecognizer(
      link,
      listening,
      NOW + 60_000,
    );

    // Then
    expect(result).toBe(false);
  });

  it.each(['preparing', 'paused', 'finalizing'] as const)(
    '듣는 중이 아닌 %s에서는 다시 열지 않는다',
    (status) => {
      // Given
      const state = createCaptureState(
        status === 'paused' ? { status, cause: 'user' } : { status },
      );

      // When
      const result = VoiceRecognizerLinkPolicy.shouldRestartStalledRecognizer(
        {
          ...VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
          isStopRequested: false,
          stallWatch: watch(),
        },
        state,
        NOW + 60_000,
      );

      // Then
      expect(result).toBe(false);
    },
  );
});

describe('withVolumeSample', () => {
  it.each([
    {
      why: '말소리 샘플 사이 시간을 더한다',
      level: SPEAKING_VOLUME_THRESHOLD,
      gapMs: 50,
      expected: 50,
    },
    { why: '조용한 샘플은 더하지 않는다', level: 0, gapMs: 50, expected: 0 },
    {
      why: '샘플이 끊긴 틈은 더하지 않는다',
      level: SPEAKING_VOLUME_THRESHOLD,
      gapMs: 251,
      expected: 0,
    },
  ])('$why', ({ level, gapMs, expected }) => {
    // Given
    const stallWatch = VoiceRecognizerLinkPolicy.withVolumeSample(
      VoiceRecognizerLinkPolicy.createVoiceStallWatch(NOW),
      0,
      NOW,
    );

    // When
    const next = VoiceRecognizerLinkPolicy.withVolumeSample(stallWatch, level, NOW + gapMs);

    // Then
    expect(next.voicedMs).toBe(expected);
  });
});

describe('withTextHeard', () => {
  it('글자가 오면 들은 시간과 다시 연 시각을 지운다', () => {
    // Given
    const stallWatch = VoiceRecognizerLinkPolicy.withVolumeSample(
      VoiceRecognizerLinkPolicy.createVoiceStallWatch(NOW, NOW),
      SPEAKING_VOLUME_THRESHOLD,
      NOW,
    );

    // When
    const next = VoiceRecognizerLinkPolicy.withTextHeard(
      { ...stallWatch, voicedMs: 5_000 },
      NOW + 7_000,
    );

    // Then
    expect(next).toMatchObject({
      lastTextAt: NOW + 7_000,
      voicedMs: 0,
      lastRestartAt: null,
      lastSampleAt: NOW,
    });
  });
});

describe('reduceRecognizerLink', () => {
  it('시작을 맡기면 달리는 중이 되고 앞 구간의 멈춤 요청과 재시작 횟수를 지운다', () => {
    // Given
    const link = {
      ...VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
      isStopRequested: true,
      quickEndCount: 3,
    };

    // When
    const next = VoiceRecognizerLinkPolicy.reduceRecognizerLink(link, {
      type: 'start-requested',
      at: NOW,
    });

    // Then
    expect(next).toMatchObject({
      isRunning: true,
      isStopRequested: false,
      quickEndCount: 0,
      lastStartedAt: NOW,
    });
  });

  it('end를 받으면 달리지 않고 멈춤 요청도 지운다', () => {
    // Given
    const link = VoiceRecognizerLinkPolicy.reduceRecognizerLink(
      VoiceRecognizerLinkPolicy.reduceRecognizerLink(
        VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
        { type: 'start-requested', at: NOW },
      ),
      { type: 'stop-requested' },
    );

    // When
    const next = VoiceRecognizerLinkPolicy.reduceRecognizerLink(link, { type: 'ended' });

    // Then
    expect(next).toMatchObject({ isRunning: false, isStopRequested: false });
  });

  it('같은 글자가 다시 오면 마지막 글자 시각을 옮기지 않는다', () => {
    // Given
    const heard = VoiceRecognizerLinkPolicy.reduceRecognizerLink(
      VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
      {
        type: 'text-heard',
        transcript: '장보기',
        at: NOW,
      },
    );

    // When
    const repeated = VoiceRecognizerLinkPolicy.reduceRecognizerLink(heard, {
      type: 'text-heard',
      transcript: '장보기',
      at: NOW + 1_000,
    });

    // Then
    expect(repeated.lastTextAt).toBe(NOW);
  });

  it('stop 뒤의 마지막 글자는 다시 연 간격을 지우지 않는다', () => {
    // Given
    const link = VoiceRecognizerLinkPolicy.reduceRecognizerLink(
      VoiceRecognizerLinkPolicy.reduceRecognizerLink(
        VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
        { type: 'stall-restarted', at: NOW },
      ),
      { type: 'stop-requested' },
    );

    // When
    const next = VoiceRecognizerLinkPolicy.reduceRecognizerLink(link, {
      type: 'text-heard',
      transcript: '마지막 글자',
      at: NOW + 500,
    });

    // Then
    expect(next.stallWatch.lastRestartAt).toBe(NOW);
  });

  it('인식기 시작 신호는 다시 연 간격을 남기고 감시를 새로 센다', () => {
    // Given
    const link = VoiceRecognizerLinkPolicy.reduceRecognizerLink(
      VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
      {
        type: 'stall-restarted',
        at: NOW,
      },
    );

    // When
    const next = VoiceRecognizerLinkPolicy.reduceRecognizerLink(link, {
      type: 'started',
      at: NOW + 200,
    });

    // Then
    expect(next.stallWatch).toMatchObject({ lastTextAt: NOW + 200, lastRestartAt: NOW });
  });
});

describe('isRestartLooping', () => {
  it('400ms 안에 네 번째로 끝나면 다시 열어도 소용없다고 본다', () => {
    // Given
    const link = {
      ...VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
      lastStartedAt: NOW,
      quickEndCount: 3,
    };

    // When
    const isLooping = VoiceRecognizerLinkPolicy.isRestartLooping(link, NOW + 399);

    // Then
    expect(isLooping).toBe(true);
  });

  it('간격이 벌어지면 횟수와 상관없이 다시 연다', () => {
    // Given
    const link = {
      ...VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
      lastStartedAt: NOW,
      quickEndCount: 3,
    };

    // When
    const isLooping = VoiceRecognizerLinkPolicy.isRestartLooping(link, NOW + 400);

    // Then
    expect(isLooping).toBe(false);
  });
});

describe('isSpeaking', () => {
  const link = (lastTextAt: number | null) => ({
    ...VoiceRecognizerLinkPolicy.createVoiceRecognizerLink(),
    lastTextAt,
  });

  it.each([
    { title: '음량이 기준보다 작으면 말이 아니다', level: 0.17, lastTextAt: NOW, expected: false },
    { title: '음량이 기준과 같으면 말소리로 본다', level: 0.18, lastTextAt: NOW, expected: true },
    {
      // 글자가 온 지 1,499ms < 1,500ms
      title: '음량이 크고 글자가 방금 왔으면 말이다',
      level: 0.5,
      lastTextAt: NOW - 1_499,
      expected: true,
    },
    {
      // 글자가 온 지 1,500ms = 1,500ms
      title: '음량이 커도 새 글자가 끊겼으면 주변 소리다',
      level: 0.5,
      lastTextAt: NOW - 1_500,
      expected: false,
    },
    { title: '아직 글자가 없으면 음량으로만 본다', level: 0.5, lastTextAt: null, expected: true },
  ])('$title', ({ level, lastTextAt, expected }) => {
    // Given
    const current = link(lastTextAt);

    // When
    const result = VoiceRecognizerLinkPolicy.isSpeaking(current, level, NOW);

    // Then
    expect(result).toBe(expected);
  });
});
