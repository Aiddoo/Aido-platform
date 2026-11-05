import '@src/shared/i18n/init';
import {
  createErrorReporterStub,
  createMockAnalytics,
  createSpeechRecognizerStub,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { Text } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { SPEAKING_VOLUME_THRESHOLD } from '../constants/voice.constants';
import type { CapturedPlan } from '../domains/voice-capture.model';
import { useVoiceCaptureSession } from './use-voice-capture-session';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function SessionProbe({
  onCaptured,
  mode = 'quick',
}: {
  onCaptured: (transcript: string) => Promise<CapturedPlan | null>;
  mode?: 'quick' | 'note';
}) {
  const session = useVoiceCaptureSession({
    entry: 'add_todo_sheet',
    mode,
    maxSeconds: null,
    onCaptured,
  });

  return (
    <>
      <Pressable
        testID="begin"
        onPress={() => session.begin({ locale: 'ko-KR', contextualStrings: ['기획팀'] })}
      />
      <Pressable testID="finish" onPress={session.finish} />
      <Pressable testID="pause" onPress={session.pause} />
      <Pressable testID="resume" onPress={session.resume} />
      <Pressable testID="change-locale" onPress={() => session.changeLocale('en-US')} />
      <Pressable testID="cancel" onPress={session.cancel} />
      <Text testID="status">{session.state.status}</Text>
    </>
  );
}

async function renderSession({ mode }: { mode?: 'quick' | 'note' } = {}) {
  const speechRecognizer = createSpeechRecognizerStub();
  const analytics = createMockAnalytics();
  const onCaptured = jest.fn().mockResolvedValue(null);
  await renderUi(<SessionProbe onCaptured={onCaptured} mode={mode} />, {
    di: { speechRecognizer, analytics, logger, errorReporter: createErrorReporterStub() },
  });
  return { speechRecognizer, analytics, onCaptured };
}

describe('useVoiceCaptureSession', () => {
  it('기기 인식이 가능하면 기기 인식으로 시작하고 실제 값을 분석에 남긴다', async () => {
    // Given
    const { speechRecognizer, analytics } = await renderSession();

    // When
    await fireEvent.press(screen.getByTestId('begin'));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'quick', isOnDevice: true, contextualStrings: ['기획팀'] }),
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'voice_capture_started',
      expect.objectContaining({ mode: 'quick', on_device: true, locale: 'ko-KR' }),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('listening');
  });

  it('다 말했어요를 누르면 모은 글자를 한 번만 넘기고 말한 내용은 분석에 싣지 않는다', async () => {
    // Given
    const { speechRecognizer, analytics, onCaptured } = await renderSession();
    await fireEvent.press(screen.getByTestId('begin'));
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
    await fireEvent.press(screen.getByTestId('finish'));
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
      jest.useRealTimers();
    });

    const startSpeaking = async () => {
      const session = await renderSession();
      await fireEvent.press(screen.getByTestId('begin'));
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
    const { speechRecognizer, onCaptured } = await renderSession();
    await fireEvent.press(screen.getByTestId('begin'));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(onCaptured).not.toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
  });

  describe('앱이 멈춘 뒤 Android 인식기가 client로 답할 때', () => {
    const beginListening = async () => {
      const session = await renderSession();
      logger.error.mockClear();
      await fireEvent.press(screen.getByTestId('begin'));
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
      const { speechRecognizer, analytics, onCaptured } = await beginListening();

      // When
      await fireEvent.press(screen.getByTestId('finish'));
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
      const { speechRecognizer, analytics } = await beginListening();

      // When
      await fireEvent.press(screen.getByTestId('pause'));
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
      const { speechRecognizer } = await beginListening();
      await fireEvent.press(screen.getByTestId('pause'));
      await fireEvent.press(screen.getByTestId('resume'));

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
      const { speechRecognizer } = await beginListening();
      await fireEvent.press(screen.getByTestId('change-locale'));
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
      const { speechRecognizer } = await beginListening();
      await fireEvent.press(screen.getByTestId('change-locale'));
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
      await fireEvent.press(screen.getByTestId('begin'));
      await emit(session.speechRecognizer, { type: 'start' });
      return session;
    };

    it('침묵 끝에 세션이 끝나면 같은 옵션으로 몇 번이든 이어 듣고 글자를 모은다', async () => {
      // Given
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
      await fireEvent.press(screen.getByTestId('finish'));
      await emit(speechRecognizer, { type: 'end' });

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(3);
      expect(speechRecognizer.start).toHaveBeenLastCalledWith(firstOptions);
      expect(onCaptured).toHaveBeenCalledWith('첫 문장 둘째 문장');
    });

    describe('글자 없이 말소리만 들리는 시간을 재서', () => {
      const SAMPLE_MS = 50;
      const VOICE = SPEAKING_VOLUME_THRESHOLD;
      const QUIET = 0;

      beforeEach(() => {
        jest.useFakeTimers({ advanceTimers: true });
      });

      afterEach(() => {
        jest.useRealTimers();
      });

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
        const { speechRecognizer, onCaptured } = await beginNote();
        await hearText(speechRecognizer, '듣던 말');
        await hearVolume(speechRecognizer, VOICE, 6_100);
        await emit(speechRecognizer, { type: 'end' });
        await emit(speechRecognizer, { type: 'start' });

        // When
        await hearText(speechRecognizer, '다음 말');
        await fireEvent.press(screen.getByTestId('finish'));
        await emit(speechRecognizer, { type: 'end' });

        // Then
        expect(onCaptured).toHaveBeenCalledWith('듣던 말 다음 말');
      });

      it('stop에 답이 없으면 abort로 닫고 그 end 뒤에 새로 연다', async () => {
        // Given
        const { speechRecognizer } = await beginNote();
        await hearVolume(speechRecognizer, VOICE, 6_100);

        // When
        await act(async () => jest.advanceTimersByTime(1_600));
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
        const { speechRecognizer } = await beginNote();
        await hearText(speechRecognizer, '남길 말');
        await hearVolume(speechRecognizer, VOICE, 6_100);

        // When
        await fireEvent.press(screen.getByTestId('finish'));
        await act(async () => jest.advanceTimersByTime(1_000));

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
    const { speechRecognizer, analytics } = await renderSession();
    await fireEvent.press(screen.getByTestId('begin'));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await fireEvent.press(screen.getByTestId('change-locale'));

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
    const speechRecognizer = createSpeechRecognizerStub();
    const { unmount } = await renderUi(<SessionProbe onCaptured={jest.fn()} />, {
      di: {
        speechRecognizer,
        analytics: createMockAnalytics(),
        logger,
        errorReporter: createErrorReporterStub(),
      },
    });
    await fireEvent.press(screen.getByTestId('begin'));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await act(async () => unmount());

    // Then
    expect(speechRecognizer.abort).toHaveBeenCalledTimes(1);
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });
});
