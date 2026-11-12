import '@src/shared/i18n/init';
import type { MissingSpeechPermission } from '@src/core/ports/speech-recognizer';
import { Button, OverlayProvider } from '@src/shared/ui';
import { createLoggerStub, createSpeechRecognizerStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { useEnsureMicrophonePermission } from './use-ensure-microphone-permission';

function PermissionProbe({ onResult }: { onResult: (isGranted: boolean) => void }) {
  const ensurePermission = useEnsureMicrophonePermission();

  return (
    <Button
      onPress={() => {
        ensurePermission('quick', 'ko-KR').then(onResult, jest.fn());
      }}
    >
      시작
    </Button>
  );
}

async function renderBlocked(missing: MissingSpeechPermission) {
  const speechRecognizer = createSpeechRecognizerStub();
  speechRecognizer.getPermission.mockResolvedValue({
    isGranted: false,
    canAskAgain: false,
    missing,
  });
  const onResult = jest.fn();
  await renderScreen(
    <OverlayProvider>
      <PermissionProbe onResult={onResult} />
    </OverlayProvider>,
    { di: createTestDi({ ports: { speechRecognizer, logger: createLoggerStub() } }) },
  );

  return { speechRecognizer, onResult };
}

describe('useEnsureMicrophonePermission', () => {
  it('음성 인식만 막혔으면 음성 인식 권한을 말하고 마이크를 말하지 않는다', async () => {
    // Given
    await renderBlocked('speech-recognition');

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    expect(await screen.findByText('음성 인식 권한 필요')).toBeTruthy();
    expect(screen.queryByText('마이크 권한 필요')).toBeNull();
  });

  it('마이크만 막혔으면 마이크 권한을 말한다', async () => {
    // Given
    await renderBlocked('microphone');

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    expect(await screen.findByText('마이크 권한 필요')).toBeTruthy();
  });

  it('둘 다 막혔으면 두 권한을 함께 말한다', async () => {
    // Given
    await renderBlocked('both');

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    expect(await screen.findByText('마이크·음성 인식 권한 필요')).toBeTruthy();
  });

  it('막혀 있으면 다시 묻지 않고 설정 이동을 고를 수 있게 한다', async () => {
    // Given
    const { speechRecognizer } = await renderBlocked('speech-recognition');

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    expect(await screen.findByText('설정으로 이동')).toBeTruthy();
    expect(speechRecognizer.requestPermission).not.toHaveBeenCalled();
  });
});
