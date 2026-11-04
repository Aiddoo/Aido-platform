import '@src/shared/i18n/init';
import {
  createErrorReporterStub,
  createMockAnalytics,
  createSpeechRecognizerStub,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { Text } from '@src/shared/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { useVoiceCaptureSession } from './use-voice-capture-session';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function SessionProbe({ onCaptured }: { onCaptured: (transcript: string) => Promise<void> }) {
  const session = useVoiceCaptureSession({ entry: 'add_todo_sheet', onCaptured });

  return (
    <>
      <Pressable
        testID="begin"
        onPress={() => session.begin({ locale: 'ko-KR', contextualStrings: ['기획팀'] })}
      />
      <Pressable testID="finish" onPress={session.finish} />
      <Pressable testID="cancel" onPress={session.cancel} />
      <Text testID="status">{session.state.status}</Text>
    </>
  );
}

async function renderSession() {
  const speechRecognizer = createSpeechRecognizerStub();
  const analytics = createMockAnalytics();
  const onCaptured = jest.fn().mockResolvedValue(undefined);
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
