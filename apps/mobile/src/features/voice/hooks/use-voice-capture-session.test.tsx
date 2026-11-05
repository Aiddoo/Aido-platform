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

import type { CapturedPlan } from '../domains/voice-capture.model';
import { useVoiceCaptureSession } from './use-voice-capture-session';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function SessionProbe({
  onCaptured,
}: {
  onCaptured: (transcript: string) => Promise<CapturedPlan | null>;
}) {
  const session = useVoiceCaptureSession({ entry: 'add_todo_sheet', onCaptured });

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

async function renderSession() {
  const speechRecognizer = createSpeechRecognizerStub();
  const analytics = createMockAnalytics();
  const onCaptured = jest.fn().mockResolvedValue(null);
  await renderUi(<SessionProbe onCaptured={onCaptured} />, {
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
