import '@src/shared/i18n/init';
import { createCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { Button, OverlayProvider } from '@src/shared/ui';
import {
  createHttpClientStub,
  createSpeechRecognizerStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import {
  useVoiceCaptureReadiness,
  type VoiceCaptureReadiness,
} from './use-voice-capture-readiness';

const ACCOUNT_ID = 'user-1';

function ReadinessProbe({ onResult }: { onResult: (readiness: VoiceCaptureReadiness) => void }) {
  const ensureReady = useVoiceCaptureReadiness({
    feature: 'VOICE_NOTE',
    surface: 'voice_note',
    mode: 'note',
  });

  return (
    <Button
      onPress={() => {
        ensureReady({ locale: 'ko-KR' }).then(onResult).catch(jest.fn());
      }}
    >
      시작
    </Button>
  );
}

/** 답을 기다리는 사이 시작한 화면이 내려가면 그 화면이 띄운 시트도 답 없이 닫힌다 */
function ReadinessHarness({ onResult }: { onResult: (readiness: VoiceCaptureReadiness) => void }) {
  const [isProbeShown, setIsProbeShown] = useState(true);

  return (
    <>
      {isProbeShown && <ReadinessProbe onResult={onResult} />}
      <Button onPress={() => setIsProbeShown(false)}>떠나기</Button>
    </>
  );
}

async function renderReadiness() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const { syncStorage } = createCoachmarkStorage([]);
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  // 이전 안내에 동의했고 재안내를 아직 보지 않아 듣기 전에 재안내가 뜬다
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.detail(),
    createConsent({ aiDataSharingDecision: 'AGREED', aiDataSharingConsentVersion: '2026-10-26' }),
  );
  const onResult = jest.fn<void, [VoiceCaptureReadiness]>();

  await renderScreen(
    <LocalDateProvider>
      <OverlayProvider>
        <ReadinessHarness onResult={onResult} />
      </OverlayProvider>
    </LocalDateProvider>,
    { queryClient, di: { httpClient, syncStorage, speechRecognizer } },
  );

  return { speechRecognizer, onResult };
}

describe('useVoiceCaptureReadiness', () => {
  setupFakeTimersPerTest({ advanceTimers: true });

  it('재안내를 닫은 뒤에 마이크 권한을 묻고 준비됐다고 돌려준다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, onResult } = await renderReadiness();
    await user.press(screen.getByRole('button', { name: '시작' }));
    await screen.findByTestId('ai-consent-sheet');
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();

    // When
    await user.press(screen.getByRole('button', { name: '나중에' }));

    // Then
    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({ isReady: true, wasConsentAsked: true }),
    );
    expect(speechRecognizer.getPermission).toHaveBeenCalledWith('note', 'ko-KR');
  });

  // 재안내는 답 없이 닫혀도 하던 일을 이어 가는 안내라, 이 확인이 없으면 내려간 화면이 마이크를 연다
  it('재안내를 기다리는 사이 화면이 내려가면 마이크 권한을 묻지 않고 준비되지 않았다고 돌려준다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, onResult } = await renderReadiness();
    await user.press(screen.getByRole('button', { name: '시작' }));
    await screen.findByTestId('ai-consent-sheet');

    // When
    await user.press(screen.getByRole('button', { name: '떠나기' }));

    // Then
    await waitFor(() => expect(onResult).toHaveBeenCalledWith({ isReady: false }));
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
  });
});
