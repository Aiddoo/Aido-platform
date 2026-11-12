import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import { createCaptureState, createTranscript } from '../../__tests__/voice.fixtures';
import { QuickVoiceFailed } from './quick-voice-steps';

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
