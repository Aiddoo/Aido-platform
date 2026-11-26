import '@src/shared/i18n/init';
import type { MissingSpeechPermission, SpeechMode } from '@src/core/ports/speech-recognizer';
import { Button, OverlayProvider } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createAppLoggerStub,
  createExternalLinkGatewayStub,
  createSpeechRecognizerStub,
  createTestDi,
  getTrackedEvents,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { useEnsureMicrophonePermission } from './use-ensure-microphone-permission';

interface PermissionProbeProps {
  mode: SpeechMode;
  onResult: (isGranted: boolean) => void;
}

function PermissionProbe({ mode, onResult }: PermissionProbeProps) {
  const ensurePermission = useEnsureMicrophonePermission();

  return (
    <Button
      onPress={() => {
        ensurePermission(mode, 'ko-KR').then(onResult, jest.fn());
      }}
    >
      시작
    </Button>
  );
}

async function renderProbe(
  speechRecognizer = createSpeechRecognizerStub(),
  { mode = 'quick' }: { mode?: SpeechMode } = {},
) {
  const externalLink = createExternalLinkGatewayStub();
  const analytics = createAnalyticsStub();
  const onResult = jest.fn();
  await renderScreen(
    <OverlayProvider>
      <PermissionProbe mode={mode} onResult={onResult} />
    </OverlayProvider>,
    {
      di: createTestDi({
        ports: { speechRecognizer, externalLink, analytics, logger: createAppLoggerStub() },
      }),
    },
  );
  const getPermissionEvents = () => getTrackedEvents(analytics, 'voice_permission_requested');

  return { speechRecognizer, externalLink, onResult, getPermissionEvents };
}

async function renderBlocked(missing: MissingSpeechPermission) {
  const speechRecognizer = createSpeechRecognizerStub();
  speechRecognizer.getPermission.mockResolvedValue({
    status: 'denied',
    canAskAgain: false,
    missing,
  });
  return renderProbe(speechRecognizer);
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
    expect(await screen.findByText('설정 열기')).toBeTruthy();
    expect(speechRecognizer.requestPermission).not.toHaveBeenCalled();
  });

  it('설정 열기를 고르면 이 앱의 설정 화면을 열고 듣지 않는다', async () => {
    // Given
    const { externalLink, onResult } = await renderBlocked('microphone');
    await fireEvent.press(screen.getByText('시작'));

    // When
    await fireEvent.press(await screen.findByText('설정 열기'));

    // Then
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(externalLink.openSettings).toHaveBeenCalledTimes(1);
  });

  it('다시 물을 수 있으면 시스템 창을 한 번만 띄우고 거절하면 설정 대신 알림만 보인다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const denied = { status: 'denied', canAskAgain: true, missing: 'microphone' } as const;
    speechRecognizer.getPermission.mockResolvedValue({ ...denied, status: 'undetermined' });
    speechRecognizer.requestPermission.mockResolvedValue(denied);
    const { externalLink, onResult } = await renderProbe(speechRecognizer);

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(speechRecognizer.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('설정 열기')).toBeNull();
    expect(externalLink.openSettings).not.toHaveBeenCalled();
  });

  it('누를 때마다 권한을 다시 읽어 그 사이 설정에서 허용했으면 두 번째에 통과한다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const denied = { status: 'denied', canAskAgain: true, missing: 'microphone' } as const;
    speechRecognizer.getPermission
      .mockResolvedValueOnce(denied)
      .mockResolvedValueOnce({ status: 'granted', canAskAgain: true });
    speechRecognizer.requestPermission.mockResolvedValue(denied);
    const { onResult } = await renderProbe(speechRecognizer);
    await fireEvent.press(screen.getByText('시작'));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(true));
    expect(speechRecognizer.getPermission).toHaveBeenCalledTimes(2);
    expect(speechRecognizer.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('시스템 창을 띄울 때마다 요청 이벤트를 한 번 남긴다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    speechRecognizer.getPermission.mockResolvedValue({
      status: 'undetermined',
      canAskAgain: true,
      missing: 'microphone',
    });
    const { onResult, getPermissionEvents } = await renderProbe(speechRecognizer);

    // When
    await fireEvent.press(screen.getByText('시작'));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByText('시작'));

    // Then
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(getPermissionEvents()).toEqual([
      { mode: 'quick', status: 'granted' },
      { mode: 'quick', status: 'granted' },
    ]);
  });

  it.each<[string, SpeechMode, 'granted' | 'undetermined']>([
    ['이미 허용했으면', 'quick', 'granted'],
    ['받아쓰기는 창을 띄워도', 'dictation', 'undetermined'],
  ])('%s 요청 이벤트를 남기지 않는다', async (_case, mode, status) => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    speechRecognizer.getPermission.mockResolvedValue(
      status === 'granted'
        ? { status, canAskAgain: true }
        : { status, canAskAgain: true, missing: 'microphone' },
    );
    const { onResult, getPermissionEvents } = await renderProbe(speechRecognizer, { mode });

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(getPermissionEvents()).toEqual([]);
  });
});
