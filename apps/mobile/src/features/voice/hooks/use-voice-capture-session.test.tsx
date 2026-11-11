import '@src/shared/i18n/init';
import { Text } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createAppLifecycleGatewayStub,
  createErrorReporterStub,
  createLoggerStub,
  createSpeechRecognizerStub,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { Pressable } from 'react-native';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import type { CapturedPlan } from '../domains/voice-capture.model';
import { useVoiceCaptureSession } from './use-voice-capture-session';

/** 모델이 말소리로 보는 음량 기준보다 크다 */
const SPEAKING_LEVEL = 0.5;

let logger: ReturnType<typeof createLoggerStub>;

beforeEach(() => {
  logger = createLoggerStub();
});

function SessionProbe({
  onCaptured,
  mode = 'quick',
  maxSeconds = null,
  onLimitReached,
}: {
  onCaptured: (transcript: string) => Promise<CapturedPlan | null>;
  mode?: 'quick' | 'note';
  maxSeconds?: number | null;
  onLimitReached?: () => void;
}) {
  const session = useVoiceCaptureSession({
    entry: 'add_todo_sheet',
    mode,
    maxSeconds,
    onLimitReached,
    onCaptured,
  });

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="begin"
        onPress={() => session.begin({ locale: 'ko-KR', hintWords: ['기획팀'] })}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="begin-without-waiting"
        onPress={() => {
          session.begin({ locale: 'ko-KR', hintWords: [] }).catch(jest.fn());
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="change-locale-without-waiting"
        onPress={() => {
          session.changeLocale('en-US').catch(jest.fn());
        }}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="finish" onPress={session.finish} />
      <Pressable accessibilityRole="button" accessibilityLabel="pause" onPress={session.pause} />
      <Pressable accessibilityRole="button" accessibilityLabel="resume" onPress={session.resume} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="change-locale"
        onPress={() => session.changeLocale('en-US')}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="cancel" onPress={session.cancel} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="hand-off"
        onPress={session.handOff}
      />
      <Text testID="status">{session.state.status}</Text>
    </>
  );
}

async function renderSession({
  mode,
  maxSeconds,
  onLimitReached,
}: {
  mode?: 'quick' | 'note';
  maxSeconds?: number | null;
  onLimitReached?: () => void;
} = {}) {
  const speechRecognizer = createSpeechRecognizerStub();
  const appLifecycle = createAppLifecycleGatewayStub();
  const analytics = createAnalyticsStub();
  const errorReporter = createErrorReporterStub();
  const onCaptured = jest.fn().mockResolvedValue(null);
  const { unmount } = await renderScreen(
    <SessionProbe
      onCaptured={onCaptured}
      mode={mode}
      maxSeconds={maxSeconds}
      onLimitReached={onLimitReached}
    />,
    { di: { speechRecognizer, appLifecycle, analytics, logger, errorReporter } },
  );
  return { speechRecognizer, appLifecycle, analytics, errorReporter, onCaptured, unmount };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = noop;
  let reject: (reason: unknown) => void = noop;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return {
    promise,
    resolve: (value: T) => resolve(value),
    reject: (reason: unknown) => reject(reason),
  };
}

describe('useVoiceCaptureSession', () => {
  it('기기 인식이 가능하면 기기 인식으로 시작하고 실제 값을 분석에 남긴다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, analytics } = await renderSession();

    // When
    await user.press(screen.getByRole('button', { name: 'begin' }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'quick',
        isOnDevice: true,
        hintWords: expect.arrayContaining(['기획팀']),
      }),
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'voice_capture_started',
      expect.objectContaining({ mode: 'quick', on_device: true, locale: 'ko-KR' }),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('listening');
  });

  it('다 말했어요를 누르면 모은 글자를 한 번만 넘기고 말한 내용은 분석에 싣지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, analytics, onCaptured } = await renderSession();
    await user.press(screen.getByRole('button', { name: 'begin' }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));
    await act(async () =>
      speechRecognizer.emit({
        type: 'result',
        transcript: '내일 장보기',
        isFinal: true,
        segments: [],
      }),
    );

    // When
    await user.press(screen.getByRole('button', { name: 'finish' }));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
    expect(onCaptured).toHaveBeenCalledTimes(1);
    expect(onCaptured).toHaveBeenCalledWith('내일 장보기');
    expect(JSON.stringify(analytics.trackEvent.mock.calls)).not.toContain('장보기');
  });

  describe('자동 마무리', () => {
    const SAMPLE_MS = 50;
    const LOUD = 0.6;

    afterEach(() => {
      // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
      jest.useRealTimers();
    });

    const startSpeaking = async () => {
      const session = await renderSession();
      await userEvent.press(screen.getByRole('button', { name: 'begin' }));
      // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
      jest.useFakeTimers();
      await act(async () => session.speechRecognizer.emit({ type: 'start' }));
      return session;
    };

    const hearText = (
      speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
      transcript: string,
    ) =>
      act(async () => {
        speechRecognizer.emit({ type: 'result', transcript, isFinal: false, segments: [] });
      });

    const hearVolume = (
      speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
      durationMs: number,
    ) =>
      act(async () => {
        for (let elapsed = 0; elapsed < durationMs; elapsed += SAMPLE_MS) {
          jest.advanceTimersByTime(SAMPLE_MS);
          speechRecognizer.emit({ type: 'volume', level: LOUD });
        }
      });

    it('주변이 시끄러워도 새 글자가 끊기면 약 4초 뒤 알아서 마무리한다', async () => {
      // Given
      const { speechRecognizer } = await startSpeaking();
      await hearText(speechRecognizer, '내일 장보기');

      // When
      await hearVolume(speechRecognizer, 4_200);

      // Then
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
    });

    it('글자가 계속 들어오면 말하는 중이라 끊지 않는다', async () => {
      // Given
      const { speechRecognizer } = await startSpeaking();

      // When
      for (const transcript of [
        '내일',
        '내일 장보기',
        '내일 장보기 하고',
        '내일 장보기 하고 운동',
      ]) {
        await hearText(speechRecognizer, transcript);
        await hearVolume(speechRecognizer, 1_200);
      }

      // Then
      expect(speechRecognizer.stop).not.toHaveBeenCalled();
    });

    it('음량 이벤트가 끊겨도 말이 멈춘 것으로 보고 마무리한다', async () => {
      // Given
      const { speechRecognizer } = await startSpeaking();
      await hearText(speechRecognizer, '내일 장보기');
      await hearVolume(speechRecognizer, 100);

      // When
      await act(async () => {
        jest.advanceTimersByTime(3_000);
      });

      // Then
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
    });
  });

  it('말이 없으면 서버로 넘기지 않고 처음으로 돌아간다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, onCaptured } = await renderSession();
    await user.press(screen.getByRole('button', { name: 'begin' }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await user.press(screen.getByRole('button', { name: 'finish' }));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(onCaptured).not.toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
  });

  describe('앱이 멈춘 뒤 Android 인식기가 client로 답할 때', () => {
    const beginListening = async () => {
      const session = await renderSession();
      logger.error.mockClear();
      await userEvent.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => session.speechRecognizer.emit({ type: 'start' }));
      await act(async () =>
        session.speechRecognizer.emit({
          type: 'result',
          transcript: '내일 아침 8시에 영양제 먹기',
          isFinal: false,
          segments: [],
        }),
      );
      return session;
    };

    it('끝내기는 실패가 아니라 final 없이도 들은 글자를 넘기고 오류를 남기지 않는다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, analytics, onCaptured } = await beginListening();

      // When
      await user.press(screen.getByRole('button', { name: 'finish' }));
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // Then
      expect(onCaptured).toHaveBeenCalledWith('내일 아침 8시에 영양제 먹기');
      expect(logger.error).not.toHaveBeenCalled();
      expect(analytics.trackEvent).not.toHaveBeenCalledWith(
        'voice_capture_failed',
        expect.anything(),
      );
    });

    it('일시정지는 멈춘 채로 있고 오류를 남기지 않는다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, analytics } = await beginListening();

      // When
      await user.press(screen.getByRole('button', { name: 'pause' }));
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('paused');
      expect(logger.error).not.toHaveBeenCalled();
      expect(analytics.trackEvent).not.toHaveBeenCalledWith(
        'voice_capture_failed',
        expect.anything(),
      );
    });

    it('일시정지 직후 이어 듣기를 눌러도 늦게 온 client가 실패로 만들지 않고 end 뒤에 다시 듣는다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer } = await beginListening();
      await user.press(screen.getByRole('button', { name: 'pause' }));
      await user.press(screen.getByRole('button', { name: 'resume' }));

      // When
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('preparing');
      expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('언어를 바꾸려고 구간을 닫을 때도 실패가 아니고 새 언어로 이어 듣는다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer } = await beginListening();
      await user.press(screen.getByRole('button', { name: 'change-locale' }));
      await waitFor(() => expect(speechRecognizer.stop).toHaveBeenCalledTimes(1));

      // When
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('listening');
      expect(speechRecognizer.start).toHaveBeenLastCalledWith(
        expect.objectContaining({ locale: 'en-US' }),
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('앱이 멈춘 적 없이 듣는 중에 오는 client는 실패로 남긴다', async () => {
      // Given
      const { speechRecognizer, analytics } = await beginListening();

      // When
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('failed');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_capture_failed',
        expect.objectContaining({ reason: 'client' }),
      );
    });

    it('앞 구간이 끝나 새 구간을 듣는 중에 오는 client는 다시 실패로 본다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer } = await beginListening();
      await user.press(screen.getByRole('button', { name: 'change-locale' }));
      await waitFor(() => expect(speechRecognizer.stop).toHaveBeenCalledTimes(1));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // When
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('failed');
    });
  });

  describe('긴 녹음에서 인식기가 멈췄을 때', () => {
    const emit = (
      speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
      event: Parameters<typeof speechRecognizer.emit>[0],
    ) => act(async () => speechRecognizer.emit(event));

    const beginNote = async () => {
      const session = await renderSession({ mode: 'note' });
      await userEvent.press(screen.getByRole('button', { name: 'begin' }));
      await emit(session.speechRecognizer, { type: 'start' });
      return session;
    };

    it('침묵 끝에 세션이 끝나면 같은 옵션으로 몇 번이든 이어 듣고 글자를 모은다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, onCaptured } = await beginNote();
      const firstOptions = speechRecognizer.start.mock.calls[0]?.[0];
      await emit(speechRecognizer, {
        type: 'result',
        transcript: '첫 문장',
        isFinal: true,
        segments: [],
      });

      // When
      await emit(speechRecognizer, { type: 'end' });
      await emit(speechRecognizer, { type: 'start' });
      await emit(speechRecognizer, {
        type: 'result',
        transcript: '둘째 문장',
        isFinal: true,
        segments: [],
      });
      await emit(speechRecognizer, { type: 'end' });
      await emit(speechRecognizer, { type: 'start' });
      await user.press(screen.getByRole('button', { name: 'finish' }));
      await emit(speechRecognizer, { type: 'end' });

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(3);
      expect(speechRecognizer.start).toHaveBeenLastCalledWith(firstOptions);
      expect(onCaptured).toHaveBeenCalledWith('첫 문장 둘째 문장');
    });

    describe('글자 없이 말소리만 들리는 시간을 재서', () => {
      const SAMPLE_MS = 50;
      const VOICE = SPEAKING_LEVEL;
      const QUIET = 0;

      setupFakeTimersPerTest({ advanceTimers: true });

      const hearVolume = (
        speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
        level: number,
        durationMs: number,
      ) =>
        act(async () => {
          for (let elapsed = 0; elapsed < durationMs; elapsed += SAMPLE_MS) {
            jest.advanceTimersByTime(SAMPLE_MS);
            speechRecognizer.emit({ type: 'volume', level });
          }
        });

      const hearText = (
        speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
        transcript: string,
        isFinal = false,
      ) => emit(speechRecognizer, { type: 'result', transcript, isFinal, segments: [] });

      it.each([
        { why: '말소리가 6초 넘게 이어지면', steps: [[VOICE, 6_100]], stopCount: 1 },
        { why: '말소리가 6초에 못 미치면', steps: [[VOICE, 5_500]], stopCount: 0 },
        { why: '조용한 침묵은 아무리 길어도', steps: [[QUIET, 60_000]], stopCount: 0 },
        {
          why: '말소리가 3초에 못 미친 뒤 조용해지면',
          steps: [
            [VOICE, 2_500],
            [QUIET, 30_000],
          ],
          stopCount: 0,
        },
        {
          why: '말소리를 3초 넘게 들었어도 지금 조용하면',
          steps: [
            [VOICE, 3_500],
            [QUIET, 30_000],
          ],
          stopCount: 0,
        },
        {
          why: '조용히 오래 있다가 말소리가 3초 넘게 이어지면',
          steps: [
            [QUIET, 30_000],
            [VOICE, 3_100],
          ],
          stopCount: 1,
        },
      ])('$why 다시 여는 횟수가 $stopCount번이다', async ({ steps, stopCount }) => {
        // Given
        const { speechRecognizer } = await beginNote();

        // When
        for (const [level = QUIET, durationMs = 0] of steps) {
          await hearVolume(speechRecognizer, level, durationMs);
        }

        // Then
        expect(speechRecognizer.stop).toHaveBeenCalledTimes(stopCount);
      });

      it('빈 구간 신호가 없어도 다시 열고 end 뒤에 같은 옵션으로 이어 듣는다', async () => {
        // Given
        const { speechRecognizer, analytics } = await beginNote();
        const firstOptions = speechRecognizer.start.mock.calls[0]?.[0];
        await hearVolume(speechRecognizer, VOICE, 6_100);

        // When
        await emit(speechRecognizer, { type: 'error', code: 'client' });
        await emit(speechRecognizer, { type: 'end' });

        // Then
        expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
        expect(speechRecognizer.start).toHaveBeenLastCalledWith(firstOptions);
        expect(screen.getByTestId('status')).toHaveTextContent('listening');
        expect(analytics.trackEvent).toHaveBeenCalledWith('voice_recognizer_stalled', {
          mode: 'note',
          on_device: true,
        });
      });

      it('다시 열 때 듣던 글자를 확정해 다음 구간 글자가 덮지 않는다', async () => {
        // Given
        const user = userEvent.setup();
        const { speechRecognizer, onCaptured } = await beginNote();
        await hearText(speechRecognizer, '듣던 말');
        await hearVolume(speechRecognizer, VOICE, 6_100);
        await emit(speechRecognizer, { type: 'end' });
        await emit(speechRecognizer, { type: 'start' });

        // When
        await hearText(speechRecognizer, '다음 말');
        await user.press(screen.getByRole('button', { name: 'finish' }));
        await emit(speechRecognizer, { type: 'end' });

        // Then
        expect(onCaptured).toHaveBeenCalledWith('듣던 말 다음 말');
      });

      it('stop에 답이 없으면 abort로 닫고 그 end 뒤에 새로 연다', async () => {
        // Given
        const { speechRecognizer } = await beginNote();
        await hearVolume(speechRecognizer, VOICE, 6_100);

        // When
        await act(async () => jest.advanceTimersByTimeAsync(1_600));
        const startCountBeforeEnd = speechRecognizer.start.mock.calls.length;
        await emit(speechRecognizer, { type: 'end' });

        // Then
        expect(speechRecognizer.abort).toHaveBeenCalledTimes(1);
        expect(startCountBeforeEnd).toBe(1);
        expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('status')).toHaveTextContent('listening');
      });

      it('끝내는 중에는 답이 없어도 abort로 끊지 않는다', async () => {
        // Given
        const user = userEvent.setup();
        const { speechRecognizer } = await beginNote();
        await hearText(speechRecognizer, '남길 말');
        await hearVolume(speechRecognizer, VOICE, 6_100);

        // When
        await user.press(screen.getByRole('button', { name: 'finish' }));
        await act(async () => jest.advanceTimersByTimeAsync(1_000));

        // Then
        expect(speechRecognizer.abort).not.toHaveBeenCalled();
      });

      it('글자가 계속 오면 말소리가 길어도 다시 열지 않는다', async () => {
        // Given
        const { speechRecognizer } = await beginNote();

        // When
        for (const transcript of ['하나', '둘', '셋', '넷']) {
          await hearVolume(speechRecognizer, VOICE, 4_000);
          await hearText(speechRecognizer, transcript);
        }

        // Then
        expect(speechRecognizer.stop).not.toHaveBeenCalled();
      });

      it('시끄러운 곳에서 글자가 계속 없어도 30초 안에는 한 번만 다시 연다', async () => {
        // Given
        const { speechRecognizer } = await beginNote();
        await hearVolume(speechRecognizer, VOICE, 6_100);
        await emit(speechRecognizer, { type: 'end' });
        await emit(speechRecognizer, { type: 'start' });

        // When
        await hearVolume(speechRecognizer, VOICE, 20_000);

        // Then
        expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
      });

      it('다시 연 뒤 글자가 오면 인식기가 살아난 것이라 다음 멈춤은 간격 없이 다시 연다', async () => {
        // Given
        const { speechRecognizer } = await beginNote();
        await hearVolume(speechRecognizer, VOICE, 6_100);
        await emit(speechRecognizer, { type: 'end' });
        await emit(speechRecognizer, { type: 'start' });
        await hearText(speechRecognizer, '살아났어요', true);

        // When
        await hearVolume(speechRecognizer, VOICE, 6_100);

        // Then
        expect(speechRecognizer.stop).toHaveBeenCalledTimes(2);
      });
    });
  });

  it('듣는 중에 언어를 바꾸면 바뀐 언어를 분석에 남긴다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, analytics } = await renderSession();
    await user.press(screen.getByRole('button', { name: 'begin' }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await user.press(screen.getByRole('button', { name: 'change-locale' }));

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_capture_locale_changed', {
        mode: 'quick',
        locale: 'en-US',
        on_device: true,
      }),
    );
  });

  it('화면이 내려가면 듣던 세션을 끊고 구독을 푼다', async () => {
    // Given
    const user = userEvent.setup();
    const speechRecognizer = createSpeechRecognizerStub();
    const { unmount } = await renderScreen(<SessionProbe onCaptured={jest.fn()} />, {
      di: {
        speechRecognizer,
        analytics: createAnalyticsStub(),
        logger,
        errorReporter: createErrorReporterStub(),
      },
    });
    await user.press(screen.getByRole('button', { name: 'begin' }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await act(async () => unmount());

    // Then
    expect(speechRecognizer.abort).toHaveBeenCalledTimes(1);
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });

  describe('한 번의 길이 한도', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    it('일시정지했다 이어 들으면 남은 시간만큼만 듣고 한도를 알린다', async () => {
      // Given
      const user = userEvent.setup();
      // 10초 한도에서 4초 듣고 멈췄다
      const onLimitReached = jest.fn();
      const { speechRecognizer } = await renderSession({ maxSeconds: 10, onLimitReached });
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      await act(async () => jest.advanceTimersByTimeAsync(4_000));
      await user.press(screen.getByRole('button', { name: 'pause' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));
      await act(async () => jest.advanceTimersByTimeAsync(30_000));

      // When
      await user.press(screen.getByRole('button', { name: 'resume' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      await act(async () => jest.advanceTimersByTimeAsync(5_500));

      // Then
      expect(onLimitReached).not.toHaveBeenCalled();

      // When
      await act(async () => jest.advanceTimersByTimeAsync(700));

      // Then
      expect(onLimitReached).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('status')).toHaveTextContent('paused');
    });

    it('한도 알림을 받지 않는 화면은 한도에 닿으면 바로 끝낸다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, onCaptured } = await renderSession({ maxSeconds: 3 });
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      await act(async () =>
        speechRecognizer.emit({ type: 'result', transcript: '한 말', isFinal: true, segments: [] }),
      );

      // When
      await act(async () => jest.advanceTimersByTimeAsync(3_100));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // Then
      expect(onCaptured).toHaveBeenCalledWith('한 말');
    });
  });

  describe('인식기가 시작하자마자 끝날 때', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    const beginListening = async () => {
      const session = await renderSession({ mode: 'note' });
      await userEvent.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => session.speechRecognizer.emit({ type: 'start' }));
      return session;
    };

    it('400ms 안에 네 번 연달아 끝나면 다시 열지 않고 실패로 멈춘다', async () => {
      // Given
      const { speechRecognizer, analytics } = await beginListening();
      logger.error.mockClear();

      // When
      for (let count = 0; count < 4; count += 1) {
        await act(async () => speechRecognizer.emit({ type: 'end' }));
      }

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(4);
      expect(screen.getByTestId('status')).toHaveTextContent('failed');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_capture_failed', {
        mode: 'note',
        reason: 'client',
      });
    });

    it('구간 사이가 400ms 이상이면 몇 번이든 다시 연다', async () => {
      // Given
      const { speechRecognizer } = await beginListening();

      // When
      for (let count = 0; count < 8; count += 1) {
        await act(async () => jest.advanceTimersByTimeAsync(500));
        await act(async () => speechRecognizer.emit({ type: 'end' }));
      }

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(9);
      expect(screen.getByTestId('status')).toHaveTextContent('listening');
    });
  });

  describe('앱이 백그라운드로 갈 때', () => {
    it('시작 준비 중에 내려갔다면 시작 신호가 와도 듣지 않고 멈춘 채 기다린다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, appLifecycle } = await renderSession({ mode: 'note' });
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => appLifecycle.emit('background'));
      expect(screen.getByTestId('status')).toHaveTextContent('preparing');

      // When
      await act(async () => speechRecognizer.emit({ type: 'start' }));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('paused');
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);

      // When
      await act(async () => speechRecognizer.emit({ type: 'end' }));
      await act(async () => appLifecycle.emit('active'));
      await user.press(screen.getByRole('button', { name: 'resume' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('status')).toHaveTextContent('listening');
    });

    it('시작 신호 전에 돌아왔다면 그대로 듣는다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, appLifecycle } = await renderSession({ mode: 'note' });
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => appLifecycle.emit('background'));
      await act(async () => appLifecycle.emit('active'));

      // When
      await act(async () => speechRecognizer.emit({ type: 'start' }));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('listening');
      expect(speechRecognizer.stop).not.toHaveBeenCalled();
    });

    it('듣던 구간을 멈추고 돌아와 이어 들으면 같은 옵션으로 다시 연다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, appLifecycle, analytics, errorReporter } = await renderSession({
        mode: 'note',
      });
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      const firstOptions = speechRecognizer.start.mock.calls[0]?.[0];

      // When
      await act(async () => appLifecycle.emit('background'));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('paused');
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
      expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
        category: 'voice',
        message: 'capture.paused',
        data: { mode: 'note', cause: 'app-background' },
      });

      // When
      await act(async () => speechRecognizer.emit({ type: 'end' }));
      await act(async () => appLifecycle.emit('active'));
      await user.press(screen.getByRole('button', { name: 'resume' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
      expect(speechRecognizer.start).toHaveBeenLastCalledWith(firstOptions);
      expect(screen.getByTestId('status')).toHaveTextContent('listening');
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_capture_resumed', {
        mode: 'note',
        cause: 'app_background',
      });
    });

    it('통화로 인식기가 끊기면 들은 글자를 든 채 멈춘다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, errorReporter } = await renderSession();
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));

      // When
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'interrupted' }));

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('paused');
      expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
        category: 'voice',
        message: 'capture.paused',
        data: { mode: 'quick', cause: 'interrupted' },
      });
    });
  });

  it('언어를 바꾼 뒤 다시 열 때는 그 언어의 기기 인식 여부로 시작한다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer } = await renderSession();
    await user.press(screen.getByRole('button', { name: 'begin' }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));
    speechRecognizer.getCapabilities.mockResolvedValueOnce({
      isAvailable: true,
      canRecognizeOnDevice: false,
      canDownloadOnDeviceModel: true,
      canSaveRecording: true,
      canContinue: true,
    });

    // When
    await user.press(screen.getByRole('button', { name: 'change-locale' }));
    await waitFor(() => expect(speechRecognizer.stop).toHaveBeenCalledTimes(1));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(speechRecognizer.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ locale: 'en-US', isOnDevice: false }),
    );
  });

  it('기기 인식이 안 되는 언어로 바꾸면 내 카테고리·할 일 이름을 인식기에 주지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer } = await renderSession();
    await user.press(screen.getByRole('button', { name: 'begin' }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));
    speechRecognizer.getCapabilities.mockResolvedValueOnce({
      isAvailable: true,
      canRecognizeOnDevice: false,
      canDownloadOnDeviceModel: true,
      canSaveRecording: true,
      canContinue: true,
    });

    // When
    await user.press(screen.getByRole('button', { name: 'change-locale' }));
    await waitFor(() => expect(speechRecognizer.stop).toHaveBeenCalledTimes(1));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(speechRecognizer.start).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isOnDevice: false,
        hintWords: expect.not.arrayContaining(['기획팀']),
      }),
    );
  });

  it('화면이 내려가면 구독을 먼저 풀고 인식기를 끊어 끊김 이벤트가 세션에 오지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, unmount } = await renderSession();
    await user.press(screen.getByRole('button', { name: 'begin' }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));
    const listenerCountsAtAbort: number[] = [];
    speechRecognizer.abort.mockImplementation(() => {
      listenerCountsAtAbort.push(speechRecognizer.getListenerCount());
    });

    // When
    await act(async () => unmount());

    // Then
    expect(listenerCountsAtAbort).toEqual([0]);
  });

  describe('기능 확인을 기다리는 사이 화면이 내려가면', () => {
    const FULL = {
      isAvailable: true,
      canRecognizeOnDevice: true,
      canDownloadOnDeviceModel: false,
      canSaveRecording: true,
      canContinue: true,
    };

    const beginThenUnmount = async () => {
      const session = await renderSession();
      const capabilities = createDeferred<typeof FULL>();
      session.speechRecognizer.getCapabilities.mockReturnValue(capabilities.promise);
      await userEvent.press(screen.getByRole('button', { name: 'begin-without-waiting' }));
      await act(async () => session.unmount());
      return { ...session, capabilities };
    };

    it('인식기를 시작하지 않아 마이크가 켜진 채 남지 않는다', async () => {
      // Given
      const { speechRecognizer, analytics, capabilities } = await beginThenUnmount();

      // When
      await act(async () => capabilities.resolve(FULL));

      // Then
      expect(speechRecognizer.start).not.toHaveBeenCalled();
      expect(analytics.trackEvent).not.toHaveBeenCalledWith(
        'voice_capture_started',
        expect.anything(),
      );
    });

    it('확인이 늦게 실패해도 오류와 실패 이벤트를 남기지 않는다', async () => {
      // Given
      const { analytics, capabilities } = await beginThenUnmount();
      logger.error.mockClear();

      // When
      await act(async () => capabilities.reject(new Error('native')));

      // Then
      expect(logger.error).not.toHaveBeenCalled();
      expect(analytics.trackEvent).not.toHaveBeenCalledWith(
        'voice_capture_failed',
        expect.anything(),
      );
    });

    it('언어 확인이 늦게 끝나도 다른 세션의 인식기를 멈추지 않는다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, unmount } = await renderSession();
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      const capabilities = createDeferred<typeof FULL>();
      speechRecognizer.getCapabilities.mockReturnValue(capabilities.promise);
      await user.press(screen.getByRole('button', { name: 'change-locale-without-waiting' }));

      // When
      await act(async () => unmount());
      await act(async () => capabilities.resolve(FULL));

      // Then
      expect(speechRecognizer.stop).not.toHaveBeenCalled();
    });
  });

  describe('분석과 진단 값', () => {
    const beginListening = async (options?: { mode?: 'quick' | 'note' }) => {
      const session = await renderSession(options);
      logger.error.mockClear();
      logger.info.mockClear();
      await userEvent.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => session.speechRecognizer.emit({ type: 'start' }));
      return session;
    };

    const say = (speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>) =>
      act(async () =>
        speechRecognizer.emit({ type: 'result', transcript: '한 말', isFinal: true, segments: [] }),
      );

    it('시작을 이벤트와 breadcrumb으로 남긴다', async () => {
      // When
      const { analytics, errorReporter } = await beginListening();

      // Then
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_capture_started', {
        mode: 'quick',
        entry: 'add_todo_sheet',
        locale: 'ko-KR',
        on_device: true,
      });
      expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
        category: 'voice',
        message: 'capture.started',
        data: { mode: 'quick', locale: 'ko-KR', on_device: true },
      });
    });

    it('글자가 있으면 끝을 completed로, 정리 요청을 breadcrumb으로 남긴다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, analytics, errorReporter } = await beginListening();
      await say(speechRecognizer);

      // When
      await user.press(screen.getByRole('button', { name: 'finish' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // Then
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_capture_finished', {
        mode: 'quick',
        outcome: 'completed',
        duration_bucket: expect.any(String),
        pause_count: 0,
      });
      expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
        category: 'voice',
        message: 'capture.finished',
        data: { mode: 'quick', duration_bucket: expect.any(String) },
      });
      expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
        category: 'voice',
        message: 'plan.requested',
        data: { mode: 'quick' },
      });
    });

    it('글자가 없으면 끝을 empty로 남긴다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, analytics } = await beginListening();

      // When
      await user.press(screen.getByRole('button', { name: 'finish' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // Then
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_capture_finished',
        expect.objectContaining({ outcome: 'empty' }),
      );
    });

    it('일시정지 뒤에 끝내도 멈춘 횟수와 함께 completed로 남긴다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, analytics } = await beginListening();
      await say(speechRecognizer);
      await user.press(screen.getByRole('button', { name: 'pause' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));

      // When
      await user.press(screen.getByRole('button', { name: 'finish' }));

      // Then
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_capture_finished',
        expect.objectContaining({ outcome: 'completed', pause_count: 1 }),
      );
    });

    it.each([
      { button: 'cancel', outcome: 'cancelled' },
      { button: 'hand-off', outcome: 'upgraded' },
    ])('$button은 들은 글자가 있으면 $outcome으로 남기고 인식기를 끊는다', async (expected) => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, analytics } = await beginListening();
      await say(speechRecognizer);

      // When
      await user.press(screen.getByRole('button', { name: expected.button }));

      // Then
      expect(speechRecognizer.abort).toHaveBeenCalledTimes(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_capture_finished',
        expect.objectContaining({ outcome: expected.outcome }),
      );
    });

    it('취소해도 들은 글자가 없으면 empty로 남긴다', async () => {
      // Given
      const user = userEvent.setup();
      const { analytics } = await beginListening();

      // When
      await user.press(screen.getByRole('button', { name: 'cancel' }));

      // Then
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_capture_finished',
        expect.objectContaining({ outcome: 'empty' }),
      );
    });

    it('일시정지와 이어 듣기를 남긴다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, analytics, errorReporter } = await beginListening();

      // When
      await user.press(screen.getByRole('button', { name: 'pause' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));
      await user.press(screen.getByRole('button', { name: 'resume' }));

      // Then
      expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
        category: 'voice',
        message: 'capture.paused',
        data: { mode: 'quick', cause: 'user' },
      });
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_capture_resumed', {
        mode: 'quick',
        cause: 'user',
      });
      expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
        category: 'voice',
        message: 'capture.resumed',
        data: { mode: 'quick' },
      });
    });

    it.each(['not-allowed', 'audio-capture'] as const)(
      '%s로 실패하면 실패 이벤트를 남기고 글자를 든 채 멈춘다',
      async (code) => {
        // Given
        const { speechRecognizer, analytics } = await beginListening();
        await say(speechRecognizer);

        // When
        await act(async () => speechRecognizer.emit({ type: 'error', code }));

        // Then
        expect(screen.getByTestId('status')).toHaveTextContent('failed');
        expect(analytics.trackEvent).toHaveBeenCalledWith('voice_capture_failed', {
          mode: 'quick',
          reason: code,
        });
      },
    );

    it('앱이 고칠 수 없는 오류만 Sentry 오류로 남기고 나머지는 정보로 남긴다', async () => {
      // Given
      const { speechRecognizer } = await beginListening();

      // When
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'no-speech' }));

      // Then
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(VOICE_LOG_EVENT.RECOGNIZER_EXPECTED_STOP, {
        speech_error: 'no-speech',
        on_device: true,
      });

      // When
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'audio-capture' }));

      // Then
      expect(logger.error).toHaveBeenCalledWith(
        VOICE_LOG_EVENT.RECOGNIZER_FAILED,
        expect.any(Error),
        { speech_error: 'audio-capture', on_device: true },
      );
    });

    it('기능 확인이 실패하면 오류를 남기고 실패로 멈춘다', async () => {
      // Given
      const user = userEvent.setup();
      const speechRecognizer = createSpeechRecognizerStub();
      speechRecognizer.getCapabilities.mockRejectedValue(new Error('native'));
      logger.error.mockClear();
      await renderScreen(<SessionProbe onCaptured={jest.fn()} />, {
        di: {
          speechRecognizer,
          analytics: createAnalyticsStub(),
          logger,
          errorReporter: createErrorReporterStub(),
        },
      });

      // When
      await user.press(screen.getByRole('button', { name: 'begin' }));

      // Then
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));
      expect(speechRecognizer.start).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        VOICE_LOG_EVENT.RECOGNIZER_FAILED,
        expect.any(Error),
        { speech_error: 'unknown' },
      );
    });

    it('인식을 쓸 수 없는 기기는 시작하지 않고 실패로 멈춘다', async () => {
      // Given
      const user = userEvent.setup();
      const speechRecognizer = createSpeechRecognizerStub();
      speechRecognizer.getCapabilities.mockResolvedValue({
        isAvailable: false,
        canRecognizeOnDevice: false,
        canDownloadOnDeviceModel: false,
        canSaveRecording: false,
        canContinue: false,
      });
      await renderScreen(<SessionProbe onCaptured={jest.fn()} />, {
        di: {
          speechRecognizer,
          analytics: createAnalyticsStub(),
          logger,
          errorReporter: createErrorReporterStub(),
        },
      });

      // When
      await user.press(screen.getByRole('button', { name: 'begin' }));

      // Then
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));
      expect(speechRecognizer.start).not.toHaveBeenCalled();
    });

    it('인식을 쓸 수 없어 실패한 뒤 다시 시도하면 준비 화면에 갇히지 않고 인식기를 다시 시작한다', async () => {
      // Given
      const user = userEvent.setup();
      const speechRecognizer = createSpeechRecognizerStub();
      speechRecognizer.getCapabilities.mockResolvedValue({
        isAvailable: false,
        canRecognizeOnDevice: false,
        canDownloadOnDeviceModel: false,
        canSaveRecording: false,
        canContinue: false,
      });
      await renderScreen(<SessionProbe onCaptured={jest.fn()} />, {
        di: {
          speechRecognizer,
          analytics: createAnalyticsStub(),
          logger,
          errorReporter: createErrorReporterStub(),
        },
      });
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

      // When
      await user.press(screen.getByRole('button', { name: 'resume' }));

      // Then
      await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(1));
    });

    it('멈춘 인식기를 다시 열면 이벤트와 breadcrumb으로 남긴다', async () => {
      // Given
      // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
      jest.useFakeTimers({ advanceTimers: true });
      const { speechRecognizer, analytics, errorReporter } = await beginListening({ mode: 'note' });

      // When
      await act(async () => {
        for (let elapsed = 0; elapsed < 6_100; elapsed += 50) {
          jest.advanceTimersByTime(50);
          speechRecognizer.emit({ type: 'volume', level: SPEAKING_LEVEL });
        }
      });
      // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
      jest.useRealTimers();

      // Then
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_recognizer_stalled', {
        mode: 'note',
        on_device: true,
      });
      expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
        category: 'voice',
        message: 'capture.recognizer-stalled',
        data: { mode: 'note', on_device: true },
      });
    });
  });
});
