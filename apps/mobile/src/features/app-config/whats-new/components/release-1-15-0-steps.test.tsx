import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import '@src/shared/i18n/init';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createFeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import {
  createAnalyticsStub,
  createAppLifecycleGatewayStub,
  createErrorReporterStub,
  createHttpClientStub,
  createLoggerStub,
  createMemoryObservableSyncStorage,
  createSpeechRecognizerStub,
  createTestQueryClient,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { createWhatsNewRepository } from '../apis/whats-new.repository';
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
  const storage = createMemoryObservableSyncStorage();
  const repository = createWhatsNewRepository(storage);
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.detail(),
    createConsent({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    }),
  );

  const view = await renderScreen(<Release1150Steps />, {
    queryClient,
    withLocalDate: true,
    withOverlay: true,
    di: {
      // 앞에 있는 앱은 자정 타이머를 계속 걸어 runAllTimers가 끝나지 않는다
      appLifecycle: createAppLifecycleGatewayStub('background'),
      httpClient,
      analytics,
      logger,
      errorReporter: createErrorReporterStub(),
      whatsNewRepository: repository,
      featureAttribution: createFeatureAttributionStore(createMemoryObservableSyncStorage()),
      speechRecognizer: createSpeechRecognizerStub(),
    },
  });

  return { ...view, analytics, storage };
}

const STEPS_BEFORE_FINISH = 7;
/** 다음 버튼은 연타를 한 번으로 본다(useSingleTap) */
const TAP_GUARD_MS = 600;

async function goToFinish() {
  for (let index = 0; index < STEPS_BEFORE_FINISH; index += 1) {
    await fireEvent.press(screen.getByText('다음'));
    await act(() => jest.advanceTimersByTimeAsync(TAP_GUARD_MS));
  }
}

function getStepViews(analytics: ReturnType<typeof createAnalyticsStub>) {
  return jest
    .mocked(analytics.trackEvent)
    .mock.calls.filter(([eventName]) => eventName === 'whats_new_step_viewed');
}

describe('Release1150Steps', () => {
  setupFakeTimersPerTest();

  beforeEach(() => {
    jest.mocked(router.dismissTo).mockClear();
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
      step: 'intro',
      index: 0,
      source: 'auto',
    });
    expect(
      createWhatsNewRepository(storage).hasSeen({
        userId: ACCOUNT_ID,
        campaignId: RELEASE_1_15_0.campaignId,
      }),
    ).toBe(true);
  });

  it('소개에서 말로 메모하기를 고르면 녹음 장면으로 건너뛰고 흐름 안의 자리로 조회를 남긴다', async () => {
    // Given
    const { analytics } = await renderSteps();

    // When
    await fireEvent.press(screen.getByTestId('whats-new-intro-voice-note'));

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('whats_new_step_viewed', {
      release_id: RELEASE_1_15_0.id,
      step: 'voiceNoteRecord',
      index: 4,
      source: 'auto',
    });
  });

  it('고르기에서 체크를 끈 할 일은 목록 장면에 들어가지 않는다', async () => {
    // Given
    await renderSteps();
    await fireEvent.press(screen.getByTestId('whats-new-intro-voice-todo'));
    await fireEvent.press(screen.getByText('다음'));
    await act(() => jest.runAllTimersAsync());
    await fireEvent(screen.getByLabelText('보고서 마무리하기 추가하기'), 'selectedChange', false);

    // When
    await fireEvent.press(screen.getByText('할 일 2개 추가'));
    await act(() => jest.runAllTimersAsync());

    // Then
    expect(screen.getByText('치과에 전화하기')).toBeOnTheScreen();
    expect(screen.queryByText('보고서 마무리하기')).toBeNull();
    expect(screen.queryByText('업무')).toBeNull();
  });

  it('다음 단계로 넘어가면 받아쓰기 예시는 내려가 지난 장면의 그림이 함께 돌지 않는다', async () => {
    // Given
    await renderSteps();
    await fireEvent.press(screen.getByTestId('whats-new-intro-voice-todo'));
    // 예시 무대는 읽기 도구에서 숨겨 두어 숨은 요소까지 찾는다
    const captureFinishButton = screen.getByText('다 말했어요', { includeHiddenElements: true });

    // When
    await fireEvent.press(screen.getByText('다음'));

    // Then
    expect(captureFinishButton).not.toBeOnTheScreen();
  });

  it('마무리의 말로 할 일 만들기 카드는 흐름을 닫고 피드에서 할 일 추가 시트를 열어 바로 말하기를 시작하게 한다', async () => {
    // Given
    const { analytics, unmount } = await renderSteps();
    await goToFinish();

    // When
    await fireEvent.press(screen.getByTestId('whats-new-start-voice-todo'));
    await unmount();

    // Then
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/feed',
      params: { action: 'add-voice-todo' },
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('feature_card_cta', {
      campaign_id: RELEASE_1_15_0.campaignId,
      feature: 'voice_quick',
      source: 'auto',
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('whats_new_cta_pressed', {
      release_id: RELEASE_1_15_0.id,
      step: 'finish',
    });
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'feature_hub_dismissed',
      expect.anything(),
    );
  });

  it('마무리의 말로 메모하기 카드는 동의·권한을 묻기 전에 흐름을 닫고 메모 탭에서 시작하게 한다', async () => {
    // Given
    await renderSteps();
    await goToFinish();

    // When
    await fireEvent.press(screen.getByTestId('whats-new-start-voice-note'));

    // Then
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/memo',
      params: { startVoiceNote: '1' },
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('마무리 카드를 연달아 눌러도 CTA는 한 번만 남는다', async () => {
    // Given
    const { analytics } = await renderSteps();
    await goToFinish();

    // When
    await fireEvent.press(screen.getByTestId('whats-new-start-voice-note'));
    await fireEvent.press(screen.getByTestId('whats-new-start-voice-note'));

    // Then
    const ctaEvents = jest
      .mocked(analytics.trackEvent)
      .mock.calls.filter(([eventName]) => eventName === 'whats_new_cta_pressed');
    expect(ctaEvents).toHaveLength(1);
    expect(router.dismissTo).toHaveBeenCalledTimes(1);
  });

  it('뒤로 돌아와도 단계 조회는 단계마다 한 번만 남는다', async () => {
    // Given
    const { analytics } = await renderSteps();

    // When
    await fireEvent.press(screen.getByText('다음'));
    await act(() => jest.advanceTimersByTimeAsync(TAP_GUARD_MS));
    await fireEvent.press(screen.getByText('이전'));

    // Then
    expect(getStepViews(analytics)).toHaveLength(2);
  });

  it('마무리에서 나중에를 누르면 완료를 남기고 닫은 것으로 세지 않는다', async () => {
    // Given
    const { analytics, unmount } = await renderSteps();
    await goToFinish();

    // When
    await fireEvent.press(screen.getByTestId('whats-new-later'));
    await unmount();

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
