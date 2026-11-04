import '@src/shared/i18n/init';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { createConsent } from '@src/features/auth/__tests__/auth.factories';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { AUTH_QUERY_KEYS } from '@src/features/auth/constants/auth-query-keys';
import type { Consent } from '@src/features/auth/domains/auth.model';
import { createCoachmarkRepository } from '@src/features/feature-discovery/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { createEntitlementSnapshot } from '@src/features/subscription/__tests__/entitlement.factories';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/subscription/constants/entitlement-query-keys';
import { UserService } from '@src/features/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
  createMockTokenStore,
  createSpeechRecognizerStub,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { Button, OverlayProvider } from '@src/shared/ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useVoiceNoteStart } from './use-voice-note-start';

jest.mock('@src/shared/config/env', () => ({ ENV: { API_URL: 'http://localhost:3000' } }));

const ACCOUNT_ID = 'user-1';
const RENEWAL_SUBTITLE = 'AI 처리 업체가 늘어나 안내를 다시 드려요.';
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
  seenCoachmarks?: readonly ('ai-consent-notice' | 'ai-consent-renewal')[];
}) {
  const httpClient = createMockHttpClient();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const analytics = createMockAnalytics();
  const coachmarkRepository = createCoachmarkRepository(createMemorySyncStorage());
  seenCoachmarks.forEach((kind) => coachmarkRepository.markSeen({ accountId: ACCOUNT_ID, kind }));
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });
  queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), createConsent(consent));
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
        authService: new AuthService(httpClient, httpClient, createMockTokenStore()),
        entitlementService: new EntitlementService(httpClient, logger),
        coachmarkService: new CoachmarkService(coachmarkRepository),
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
    await waitFor(() => expect(speechRecognizer.getPermission).toHaveBeenCalledWith('note'));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('처음 쓰는 사람은 첫 안내를 닫은 뒤에야 마이크 권한을 묻는다', async () => {
    // Given
    const { speechRecognizer } = await renderStart({ consent: {} });

    // When
    await fireEvent.press(screen.getByText('시작'));
    await screen.findByTestId('ai-consent-sheet');

    // Then
    expect(screen.queryByText(RENEWAL_SUBTITLE)).toBeNull();
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('ai-consent-later'));
    await waitFor(() => expect(speechRecognizer.getPermission).toHaveBeenCalledWith('note'));
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
    await waitFor(() => expect(speechRecognizer.getPermission).toHaveBeenCalledWith('note'));
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
  });
});
