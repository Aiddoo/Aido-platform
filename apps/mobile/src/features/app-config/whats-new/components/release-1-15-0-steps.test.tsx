import '@src/shared/i18n/init';
import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createLoggerStub,
  createMemorySyncStorage,
  createSpeechRecognizerStub,
  createTestDi,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { createFeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { createWhatsNewRepository, createWhatsNewSeenKey } from '../apis/whats-new.repository';
import { RELEASE_1_15_0 } from '../constants/releases';
import { Release1150Steps } from './release-1-15-0-steps';

const ACCOUNT_ID = 'user-1';
let logger: ReturnType<typeof createLoggerStub>;

beforeEach(() => {
  logger = createLoggerStub();
});

async function renderSteps() {
  jest.mocked(useLocalSearchParams).mockReturnValue({ source: 'auto' });
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const analytics = createAnalyticsStub();
  const storage = createMemorySyncStorage();
  const repository = createWhatsNewRepository(storage);
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.consent(),
    createConsent({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    }),
  );

  const view = await renderUi(<Release1150Steps />, {
    queryClient,
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({
      httpClient,
      analytics,
      logger,
      errorReporter: createErrorReporterStub(),
      whatsNewRepository: repository,
      featureAttribution: createFeatureAttributionStore(createMemorySyncStorage()),
      recognitionLanguageRepository: createRecognitionLanguageRepository(createMemorySyncStorage()),
      speechRecognizer: createSpeechRecognizerStub(),
    }),
  });

  return { ...view, analytics, storage };
}

describe('Release1150Steps', () => {
  beforeEach(() => {
    jest.mocked(router.replace).mockClear();
    jest.mocked(router.push).mockClear();
  });

  it('처음 열면 노출을 남기고 이 계정의 캠페인을 본 것으로 기록한다', async () => {
    // When
    const { analytics, storage } = await renderSteps();

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('feature_hub_impression', {
      campaign_id: RELEASE_1_15_0.campaignId,
      source: 'auto',
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('whats_new_step_viewed', {
      release_id: RELEASE_1_15_0.id,
      step: 'voiceTodo',
      index: 0,
      source: 'auto',
    });
    expect(
      storage.get(
        createWhatsNewSeenKey({ userId: ACCOUNT_ID, campaignId: RELEASE_1_15_0.campaignId }),
      ),
    ).toBeDefined();
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
    expect(analytics.trackEvent).toHaveBeenCalledWith('whats_new_cta_pressed', {
      release_id: RELEASE_1_15_0.id,
      step: 'voiceTodo',
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

  it('뒤로 돌아와도 단계 조회는 단계마다 한 번만 남는다', async () => {
    // Given
    const { analytics } = await renderSteps();

    // When
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.press(screen.getByText('이전'));

    // Then
    const stepViews = jest
      .mocked(analytics.trackEvent)
      .mock.calls.filter(([eventName]) => eventName === 'whats_new_step_viewed');
    expect(stepViews).toHaveLength(2);
  });

  it('마지막 단계에서 완료하면 완료를 남기고 닫은 것으로 세지 않는다', async () => {
    // Given
    const { analytics, unmount } = await renderSteps();
    const now = jest.spyOn(Date, 'now');
    await fireEvent.press(screen.getByText('다음'));

    // When
    now.mockReturnValue(Date.now() + 60_000);
    await fireEvent.press(screen.getByText('완료'));
    await unmount();
    now.mockRestore();

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('whats_new_completed', {
      release_id: RELEASE_1_15_0.id,
      source: 'auto',
    });
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'feature_hub_dismissed',
      expect.anything(),
    );
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
