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

    const emitEmptySegmentWithVoice = async (
      speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
    ) => {
      await emit(speechRecognizer, { type: 'volume', level: SPEAKING_VOLUME_THRESHOLD });
      await emit(speechRecognizer, { type: 'no-match' });
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

    it('말소리는 들리는데 글자 없는 구간만 이어지면 닫고 end 뒤에 다시 듣는다', async () => {
      // Given
      const { speechRecognizer, analytics } = await beginNote();
      await emitEmptySegmentWithVoice(speechRecognizer);

      // When
      await emitEmptySegmentWithVoice(speechRecognizer);
      await emit(speechRecognizer, { type: 'error', code: 'client' });
      await emit(speechRecognizer, { type: 'end' });

      // Then
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
      expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('status')).toHaveTextContent('listening');
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_recognizer_stalled', {
        mode: 'note',
        on_device: true,
      });
    });

    it('stop에 end로 답하지 않아도 잠시 뒤 새로 열고 듣는 상태를 유지한다', async () => {
      // Given
      const { speechRecognizer } = await beginNote();
      jest.useFakeTimers({ advanceTimers: true });
      await emitEmptySegmentWithVoice(speechRecognizer);
      await emitEmptySegmentWithVoice(speechRecognizer);

      // When
      await act(async () => jest.advanceTimersByTime(1_600));
      jest.useRealTimers();

      // Then
      expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('status')).toHaveTextContent('listening');
    });

    it('조용한 구간은 글자가 없어도 다시 열지 않는다', async () => {
      // Given
      const { speechRecognizer } = await beginNote();

      // When
      await emit(speechRecognizer, { type: 'volume', level: 0 });
      await emit(speechRecognizer, { type: 'no-match' });
      await emit(speechRecognizer, { type: 'no-match' });
      await emit(speechRecognizer, { type: 'no-match' });

      // Then
      expect(speechRecognizer.stop).not.toHaveBeenCalled();
    });

    it('글자가 오면 인식기가 살아 있는 것이라 빈 구간을 처음부터 다시 센다', async () => {
      // Given
      const { speechRecognizer } = await beginNote();
      await emitEmptySegmentWithVoice(speechRecognizer);

      // When
      await emit(speechRecognizer, {
        type: 'result',
        transcript: '듣고 있어요',
        isFinal: false,
        segments: [],
      });
      await emitEmptySegmentWithVoice(speechRecognizer);

      // Then
      expect(speechRecognizer.stop).not.toHaveBeenCalled();
    });

    it('시끄러운 곳에서 빈 구간이 계속돼도 간격 안에서는 한 번만 다시 연다', async () => {
      // Given
      const { speechRecognizer } = await beginNote();
      await emitEmptySegmentWithVoice(speechRecognizer);
      await emitEmptySegmentWithVoice(speechRecognizer);
      await emit(speechRecognizer, { type: 'end' });
      await emit(speechRecognizer, { type: 'start' });

      // When
      await emitEmptySegmentWithVoice(speechRecognizer);
      await emitEmptySegmentWithVoice(speechRecognizer);

      // Then
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
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
