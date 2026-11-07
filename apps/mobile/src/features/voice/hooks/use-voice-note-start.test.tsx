import '@src/shared/i18n/init';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/constants/entitlement-query-keys';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import type { Consent } from '@src/features/identity/consent/schemas/consent.schema';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createAnalyticsStub,
  createHttpClientStub,
  createSpeechRecognizerStub,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { Button, OverlayProvider } from '@src/shared/ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createRecognitionLanguageRepository } from '../apis/recognition-language.repository';
import { useVoiceNoteStart } from './use-voice-note-start';

const ACCOUNT_ID = 'user-1';
const RENEWAL_SUBTITLE = 'AI 처리 업체가 늘어 다시 안내해요.';
const PREVIOUS_AGREEMENT: Partial<Consent> = {
  aiDataSharingDecision: 'AGREED',
  aiDataSharingConsentVersion: '2026-10-26',
};
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function StartProbe() {
  const start = useVoiceNoteStart();

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
  const coachmarkRepository = createCoachmarkRepository(createMemorySyncStorage());
  seenCoachmarks.forEach((kind) => coachmarkRepository.markSeen({ accountId: ACCOUNT_ID, kind }));
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });
  queryClient.setQueryData(CONSENT_QUERY_KEYS.consent(), createConsent(consent));
  if (voiceNoteUsed != null) {
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ used: { VOICE_NOTE: voiceNoteUsed } }),
    );
  }

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <StartProbe />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        userService: new UserService(httpClient),
        consentService: new ConsentService(httpClient),
        entitlementService: new EntitlementService(httpClient, logger),
        coachmarkService: new CoachmarkService(coachmarkRepository),
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        speechRecognizer,
        analytics,
        errorReporter: createErrorReporterStub(),
        logger,
      },
    },
  );

  return { speechRecognizer, analytics };
}

describe('useVoiceNoteStart', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('한도를 다 썼으면 한도 안내에서 멈추고 동의와 마이크를 묻지 않는다', async () => {
    // Given
    const { speechRecognizer, analytics } = await renderStart({
      consent: PREVIOUS_AGREEMENT,
      voiceNoteUsed: PLAN_CATALOG.VOICE_NOTE.free,
    });

    // When
    await fireEvent.press(screen.getByText('시작'));

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
    const { speechRecognizer } = await renderStart({ consent: PREVIOUS_AGREEMENT });

    // When
    await fireEvent.press(screen.getByText('시작'));
    await screen.findByTestId('ai-consent-sheet');

    // Then
    expect(screen.getByText(RENEWAL_SUBTITLE)).toBeOnTheScreen();
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('ai-consent-later'));
    await waitFor(() =>
      expect(speechRecognizer.getPermission).toHaveBeenCalledWith('note', 'ko-KR'),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('처음 쓰는 사람이 나중에를 누르면 마이크 권한을 묻지 않고 그 자리에서 멈춘다', async () => {
    // Given
    const { speechRecognizer } = await renderStart({ consent: {} });
    await fireEvent.press(screen.getByText('시작'));
    await screen.findByTestId('ai-consent-sheet');
    expect(screen.queryByText(RENEWAL_SUBTITLE)).toBeNull();

    // When
    await fireEvent.press(screen.getByTestId('ai-consent-later'));

    // Then
    await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('처음 쓰는 사람이 나중에를 눌렀어도 다시 누르면 안내를 다시 띄운다', async () => {
    // Given
    await renderStart({ consent: {} });
    await fireEvent.press(screen.getByText('시작'));
    await fireEvent.press(await screen.findByTestId('ai-consent-later'));
    await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
  });

  it('재안내를 이미 본 계정은 안내 없이 바로 마이크 권한을 묻는다', async () => {
    // Given
    const { speechRecognizer } = await renderStart({
      consent: PREVIOUS_AGREEMENT,
      seenCoachmarks: ['ai-consent-renewal'],
    });

    // When
    await fireEvent.press(screen.getByText('시작'));

    // Then
    await waitFor(() =>
      expect(speechRecognizer.getPermission).toHaveBeenCalledWith('note', 'ko-KR'),
    );
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
  });
});
