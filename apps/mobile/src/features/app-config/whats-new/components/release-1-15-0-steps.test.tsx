import '@src/shared/i18n/init';
import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createMemorySyncStorage,
  createSpeechRecognizerStub,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { createFeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createWhatsNewRepository } from '../apis/whats-new.repository';
import { RELEASE_1_15_0 } from '../constants/releases';
import { Release1150Steps } from './release-1-15-0-steps';

const ACCOUNT_ID = 'user-1';
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

async function renderSteps() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const analytics = createAnalyticsStub();
  const repository = createWhatsNewRepository(createMemorySyncStorage());
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.consent(),
    createConsent({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    }),
  );

  const view = await renderUi(<Release1150Steps source="auto" />, {
    queryClient,
    withLocalDate: true,
    withOverlay: true,
    di: {
      analytics,
      logger,
      errorReporter: createErrorReporterStub(),
      whatsNewRepository: repository,
      featureAttribution: createFeatureAttributionStore(createMemorySyncStorage()),
      userService: new UserService(httpClient),
      consentService: new ConsentService(httpClient),
      entitlementService: new EntitlementService(httpClient, logger),
      coachmarkService: new CoachmarkService(createCoachmarkRepository(createMemorySyncStorage())),
      recognitionLanguageRepository: createRecognitionLanguageRepository(createMemorySyncStorage()),
      speechRecognizer: createSpeechRecognizerStub(),
    },
  });

  return { ...view, analytics, repository };
}

describe('Release1150Steps', () => {
  beforeEach(() => {
    jest.mocked(router.replace).mockClear();
    jest.mocked(router.push).mockClear();
  });

  it('처음 열면 노출을 남기고 이 계정의 캠페인을 본 것으로 기록한다', async () => {
    // When
    const { analytics, repository } = await renderSteps();

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('feature_hub_impression', {
      campaign_id: RELEASE_1_15_0.campaignId,
      source: 'auto',
    });
    expect(repository.isSeen({ userId: ACCOUNT_ID, campaignId: RELEASE_1_15_0.campaignId })).toBe(
      true,
    );
  });

  it('말로 할 일 CTA는 흐름을 닫고 마이크 안내와 함께 할 일 추가 시트를 연다', async () => {
    // Given
    const { analytics, unmount } = await renderSteps();

    // When
    await fireEvent.press(screen.getByTestId('whats-new-step-action'));
    await unmount();

    // Then
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/todo/new',
      params: { voiceHint: '1' },
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('feature_card_cta', {
      campaign_id: RELEASE_1_15_0.campaignId,
      feature: 'voice_quick',
      source: 'auto',
    });
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'feature_hub_dismissed',
      expect.anything(),
    );
  });

  it('둘째 단계의 말로 메모 CTA는 한도·동의·권한을 지난 뒤 흐름을 닫고 녹음으로 간다', async () => {
    // Given
    await renderSteps();

    // When
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.press(screen.getByTestId('whats-new-step-action'));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/voice-notes/record'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('CTA 없이 화면이 사라지면 닫은 것으로 남긴다', async () => {
    // Given
    const { analytics, unmount } = await renderSteps();

    // When
    await unmount();

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('feature_hub_dismissed', {
      campaign_id: RELEASE_1_15_0.campaignId,
      source: 'auto',
    });
  });
});
