import { PLAN_CATALOG } from '@aido/api/vocabulary';
import '@src/shared/i18n/init';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { type Consent } from '@src/features/identity/consent/domains/consent.model';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { Button, OverlayProvider } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createLoggerStub,
  createSpeechRecognizerStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useStartVoiceNote } from './use-start-voice-note';

const ACCOUNT_ID = 'user-1';
const RENEWAL_SUBTITLE = 'AI 처리 업체가 늘어 다시 안내해요.';
const PREVIOUS_AGREEMENT: Partial<Consent> = {
  aiDataSharingDecision: 'AGREED',
  aiDataSharingConsentVersion: '2026-10-26',
};
let logger: ReturnType<typeof createLoggerStub>;

beforeEach(() => {
  logger = createLoggerStub();
});

function StartProbe() {
  const start = useStartVoiceNote();

  return (
    <Button
      onPress={() => {
        start().catch(jest.fn());
      }}
    >
      시작
    </Button>
  );
}

/** 동의를 미룬 뒤 뜨는 안내. 테스트가 이 토스트까지 기다려야 끝난 뒤에 타이머가 남지 않는다 */
const CONSENT_REQUIRED_TOAST = '말로 정리하려면 동의가 필요해요';

async function renderStart({
  consent,
  voiceNoteUsed,
  seenCoachmarks = [],
}: {
  consent: Partial<Consent>;
  voiceNoteUsed?: number;
  seenCoachmarks?: readonly 'ai-consent-renewal'[];
}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const analytics = createAnalyticsStub();
  const { syncStorage } = createCoachmarkStorage(
    seenCoachmarks.map((kind) => ({ accountId: ACCOUNT_ID, kind })),
  );
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), createConsent(consent));
  if (voiceNoteUsed != null) {
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ used: { VOICE_NOTE: voiceNoteUsed } }),
    );
  }

  await renderScreen(
    <LocalDateProvider>
      <OverlayProvider>
        <StartProbe />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: createTestDi({
        ports: {
          httpClient,
          syncStorage,
          speechRecognizer,
          analytics,
          errorReporter: createErrorReporterStub(),
          logger,
          queryClient,
        },
      }),
    },
  );

  return { speechRecognizer, analytics, httpClient };
}

describe('useStartVoiceNote', () => {
  // 화면을 떠난 뒤 오는 응답·동의 결과가 토스트를 띄워도 타이머가 테스트 밖에 남지 않게 한다
  setupFakeTimersPerTest({ advanceTimers: true });

  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('한도를 다 썼으면 한도 안내에서 멈추고 동의와 마이크를 묻지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, analytics } = await renderStart({
      consent: PREVIOUS_AGREEMENT,
      voiceNoteUsed: PLAN_CATALOG.VOICE_NOTE.free,
    });

    // When
    await user.press(screen.getByRole('button', { name: '시작' }));

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'limit_reached_shown',
        expect.objectContaining({ surface: 'voice_note' }),
      ),
    );
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
  });

  it('이전 안내에 동의한 사람은 재안내를 닫은 뒤에야 마이크 권한을 묻고 녹음 화면으로 간다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer } = await renderStart({ consent: PREVIOUS_AGREEMENT });

    // When
    await user.press(screen.getByRole('button', { name: '시작' }));
    await screen.findByTestId('ai-consent-sheet');

    // Then
    expect(screen.getByText(RENEWAL_SUBTITLE)).toBeOnTheScreen();
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: '나중에' }));
    await waitFor(() =>
      expect(speechRecognizer.getPermission).toHaveBeenCalledWith('note', 'ko-KR'),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('처음 쓰는 사람이 나중에를 누르면 마이크 권한을 묻지 않고 AI에도 보내지 않은 채 멈춘다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, httpClient } = await renderStart({ consent: {} });
    await user.press(screen.getByRole('button', { name: '시작' }));
    await screen.findByTestId('ai-consent-sheet');
    expect(screen.queryByText(RENEWAL_SUBTITLE)).toBeNull();

    // When
    await user.press(screen.getByRole('button', { name: '나중에' }));

    // Then
    expect(await screen.findAllByText(CONSENT_REQUIRED_TOAST)).not.toHaveLength(0);
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('처음 쓰는 사람이 나중에를 눌렀어도 다시 누르면 안내를 다시 띄운다', async () => {
    // Given
    const user = userEvent.setup();
    await renderStart({ consent: {} });
    await user.press(screen.getByRole('button', { name: '시작' }));
    await user.press(await screen.findByRole('button', { name: '나중에' }));
    await screen.findAllByText(CONSENT_REQUIRED_TOAST);

    // When
    await user.press(screen.getByRole('button', { name: '시작' }));

    // Then
    expect(await screen.findByTestId('ai-consent-sheet')).toBeOnTheScreen();
  });

  it('재안내를 이미 본 계정은 안내 없이 바로 마이크 권한을 묻는다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer } = await renderStart({
      consent: PREVIOUS_AGREEMENT,
      seenCoachmarks: ['ai-consent-renewal'],
    });

    // When
    await user.press(screen.getByRole('button', { name: '시작' }));

    // Then
    await waitFor(() =>
      expect(speechRecognizer.getPermission).toHaveBeenCalledWith('note', 'ko-KR'),
    );
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
  });

  it('마이크 권한을 얻지 못하면 녹음 화면으로 가지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer } = await renderStart({
      consent: PREVIOUS_AGREEMENT,
      seenCoachmarks: ['ai-consent-renewal'],
    });
    speechRecognizer.getPermission.mockResolvedValue({
      isGranted: false,
      canAskAgain: true,
      missing: 'microphone',
    });
    speechRecognizer.requestPermission.mockResolvedValue({
      isGranted: false,
      canAskAgain: true,
      missing: 'microphone',
    });

    // When
    await user.press(screen.getByRole('button', { name: '시작' }));

    // Then
    await waitFor(() => expect(speechRecognizer.requestPermission).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
  });
});
