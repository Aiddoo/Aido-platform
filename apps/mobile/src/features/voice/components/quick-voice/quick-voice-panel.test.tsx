import '@src/shared/i18n/init';
import { createHapticsGatewayStub, createSpeechRecognizerStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';

import { createCaptureState, createTranscript } from '../../__tests__/voice.fixtures';
import type { VoiceCaptureState } from '../../domains/voice-capture.model';
import { QuickVoiceFailed, QuickVoiceListening } from './quick-voice-panel';

function Panel({
  state,
  onContinueAsVoiceNote,
  onFinish,
}: {
  state: VoiceCaptureState;
  onContinueAsVoiceNote: () => void;
  onFinish: () => void;
}) {
  const level = useSharedValue(0);
  return (
    <QuickVoiceListening
      state={state}
      level={level}
      isQuiet={false}
      locale="ko-KR"
      onLocaleChange={jest.fn()}
      onFinish={onFinish}
      onCancel={jest.fn()}
      onResume={jest.fn()}
      onContinueAsVoiceNote={onContinueAsVoiceNote}
    />
  );
}

async function renderPanel(state: VoiceCaptureState) {
  const onContinueAsVoiceNote = jest.fn();
  const onFinish = jest.fn();
  await renderScreen(
    <Panel state={state} onContinueAsVoiceNote={onContinueAsVoiceNote} onFinish={onFinish} />,
    { di: { haptics: createHapticsGatewayStub(), speechRecognizer: createSpeechRecognizerStub() } },
  );
  return { onContinueAsVoiceNote, onFinish };
}

describe('QuickVoiceListening 90초 제안', () => {
  const overLimit = createCaptureState({
    status: 'paused',
    cause: 'limit',
    elapsedMs: 90_000,
    transcript: createTranscript({ sentences: ['길게 말한 내용.'] }),
  });

  it('90초를 넘기면 들은 글자를 보이고 두 길을 함께 제안한다', async () => {
    // Given
    const { onContinueAsVoiceNote, onFinish } = await renderPanel(overLimit);

    // When
    await fireEvent.press(screen.getByTestId('quick-voice-continue-as-note'));
    await fireEvent.press(screen.getByTestId('quick-voice-finish'));

    // Then
    expect(screen.getByText('이야기가 길어졌어요')).toBeTruthy();
    expect(screen.getByText(/길게/)).toBeTruthy();
    expect(onContinueAsVoiceNote).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('들은 내용 없이 90초를 넘기면 정리를 권하지 않고 말로 메모하기로 잇게 한다', async () => {
    // Given
    const nothingHeard = createCaptureState({
      status: 'paused',
      cause: 'limit',
      elapsedMs: 90_000,
    });

    // When
    await renderPanel(nothingHeard);

    // Then
    expect(screen.getByText('아직 들은 내용이 없어요')).toBeTruthy();
    expect(screen.queryByText(/들은 내용은 남아 있어요/)).toBeNull();
    expect(screen.queryByTestId('quick-voice-finish')).toBeNull();
    expect(screen.getByTestId('quick-voice-continue-as-note')).toBeTruthy();
  });

  it('앱 이탈로 멈춘 때는 제안하지 않고 이어 듣기를 보인다', async () => {
    // Given
    const paused = createCaptureState({
      status: 'paused',
      cause: 'app-background',
      elapsedMs: 10_000,
    });

    // When
    await renderPanel(paused);

    // Then
    expect(screen.queryByTestId('quick-voice-limit')).toBeNull();
    expect(screen.getByTestId('quick-voice-resume')).toBeTruthy();
  });
});

describe('QuickVoiceFailed', () => {
  const planningFailed = createCaptureState({
    status: 'failed',
    reason: 'planning-failed',
    transcript: createTranscript({ sentences: ['말한 내용.'] }),
  });

  it('정리가 동의 때문에 막혔으면 들은 글자 안내 대신 동의가 필요하다고 보인다', async () => {
    // When
    await renderScreen(
      <QuickVoiceFailed
        state={planningFailed}
        isConsentRequired
        onResume={jest.fn()}
        onRetryPlanning={jest.fn()}
      />,
    );

    // Then
    expect(screen.getByText(/AI 동의가 필요해요/)).toBeTruthy();
  });

  it('글자를 못 받고 실패했으면 남겨뒀다고 말하지 않는다', async () => {
    // Given
    const nothingHeard = createCaptureState({ status: 'failed', reason: 'audio-capture' });

    // When
    await renderScreen(
      <QuickVoiceFailed state={nothingHeard} onResume={jest.fn()} onRetryPlanning={jest.fn()} />,
    );

    // Then
    expect(screen.getByText(/아직 들은 내용이 없어요/)).toBeTruthy();
    expect(screen.queryByText(/남겨뒀어요/)).toBeNull();
  });

  it('다른 이유로 실패했으면 들은 글자를 남겼다고 보인다', async () => {
    // When
    await renderScreen(
      <QuickVoiceFailed state={planningFailed} onResume={jest.fn()} onRetryPlanning={jest.fn()} />,
    );

    // Then
    expect(screen.getByText(/들은 내용은 남겨뒀어요/)).toBeTruthy();
  });

  it('입력 칸에 친 글자를 그대로 뒀으면 들은 글자가 칸에 있다고 말하지 않는다', async () => {
    // When
    await renderScreen(
      <QuickVoiceFailed
        state={planningFailed}
        isTypedTextKept
        onResume={jest.fn()}
        onRetryPlanning={jest.fn()}
      />,
    );

    // Then
    expect(screen.getByText(/입력 칸에 옮기지 않았어요/)).toBeTruthy();
    expect(screen.queryByText(/직접 고쳐주세요/)).toBeNull();
  });
});
