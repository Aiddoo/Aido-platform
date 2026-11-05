import '@src/shared/i18n/init';
import { createHapticsStub } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';

import { createCaptureState, createTranscript } from '../../__tests__/voice.factories';
import type { VoiceCaptureState } from '../../domains/voice-capture.model';
import { QuickVoicePanel } from './quick-voice-panel';

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
    <QuickVoicePanel
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
  await renderUi(
    <Panel state={state} onContinueAsVoiceNote={onContinueAsVoiceNote} onFinish={onFinish} />,
    { di: { haptics: createHapticsStub() } },
  );
  return { onContinueAsVoiceNote, onFinish };
}

describe('QuickVoicePanel 90초 제안', () => {
  const overLimit = createCaptureState({
    status: 'paused',
    cause: 'limit',
    elapsedMs: 90_000,
    transcript: createTranscript({ sentences: ['길게 말한 내용.'] }),
  });

  test('90초를 넘기면 들은 글자를 보이고 두 길을 함께 제안한다', async () => {
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

  test('들은 내용 없이 90초를 넘기면 정리를 권하지 않고 말로 메모하기로 잇게 한다', async () => {
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

  test('앱 이탈로 멈춘 때는 제안하지 않고 이어 듣기를 보인다', async () => {
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

describe('QuickVoicePanel.Failed', () => {
  const planningFailed = createCaptureState({
    status: 'failed',
    reason: 'planning-failed',
    transcript: createTranscript({ sentences: ['말한 내용.'] }),
  });

  test('정리가 동의 때문에 막혔으면 들은 글자 안내 대신 동의가 필요하다고 보인다', async () => {
    // When
    await renderUi(
      <QuickVoicePanel.Failed
        state={planningFailed}
        isConsentRequired
        onResume={jest.fn()}
        onRetryPlanning={jest.fn()}
      />,
    );

    // Then
    expect(screen.getByText(/AI 동의가 필요해요/)).toBeTruthy();
  });

  test('글자를 못 받고 실패했으면 남겨뒀다고 말하지 않는다', async () => {
    // Given
    const nothingHeard = createCaptureState({ status: 'failed', reason: 'audio-capture' });

    // When
    await renderUi(
      <QuickVoicePanel.Failed
        state={nothingHeard}
        onResume={jest.fn()}
        onRetryPlanning={jest.fn()}
      />,
    );

    // Then
    expect(screen.getByText(/아직 들은 내용이 없어요/)).toBeTruthy();
    expect(screen.queryByText(/남겨뒀어요/)).toBeNull();
  });

  test('다른 이유로 실패했으면 들은 글자를 남겼다고 보인다', async () => {
    // When
    await renderUi(
      <QuickVoicePanel.Failed
        state={planningFailed}
        onResume={jest.fn()}
        onRetryPlanning={jest.fn()}
      />,
    );

    // Then
    expect(screen.getByText(/들은 내용은 남겨뒀어요/)).toBeTruthy();
  });
});
