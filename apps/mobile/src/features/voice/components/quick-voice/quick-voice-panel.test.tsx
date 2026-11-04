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
