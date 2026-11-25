import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createPreference } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import {
  createAnalyticsStub,
  createAppLifecycleGatewayStub,
  createHttpClientStub,
  createTestDi,
  createTestQueryClient,
  respondByPath,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { uniq } from 'es-toolkit';
import { router, useLocalSearchParams } from 'expo-router';

import WhatsNewRoute from '../../../../../app/(app)/whats-new/index';
import { RELEASE_1_16_0, RELEASE_1_17_0 } from '../constants/releases.constants';

const ACCOUNT_ID = 'user-1';
const CAMPAIGN_IDENTITY = { userId: ACCOUNT_ID, campaignId: RELEASE_1_17_0.campaignId };
/** 다음·뒤로 버튼은 연타를 한 번으로 본다(useSingleTap) */
const TAP_GUARD_MS = 600;
const HIDDEN = { includeHiddenElements: true } as const;

async function renderWhatsNew(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({ 'v1/entitlements': ok(createEntitlementSnapshotDto()) }),
  );
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), createPreference());
  const view = await renderScreen(<WhatsNewRoute />, {
    di: createTestDi({
      ports: {
        queryClient,
        // 앞에 있는 앱은 자정 타이머를 계속 걸어 남은 타이머가 끝나지 않는다
        appLifecycle: createAppLifecycleGatewayStub('background'),
        httpClient,
        analytics,
      },
    }),
    withLocalDate: true,
    withOverlay: true,
  });

  const countEvents = (eventName: string) =>
    analytics.trackEvent.mock.calls.filter(([name]) => name === eventName);

  return {
    ...view,
    httpClient,
    countEvents,
    getViewedSteps: () =>
      countEvents('whats_new_step_viewed').map(([, params]) => [params?.step, params?.index]),
  };
}

async function pressNext() {
  await fireEvent.press(screen.getByText('다음'));
  await act(() => jest.advanceTimersByTimeAsync(TAP_GUARD_MS));
}

async function pressBack() {
  await fireEvent.press(screen.getByText('이전'));
  await act(() => jest.advanceTimersByTimeAsync(TAP_GUARD_MS));
}

async function goToFinish(stepCount: number) {
  for (let index = 1; index < stepCount; index += 1) {
    await pressNext();
  }
  await act(() => jest.runOnlyPendingTimersAsync());
}

describe('WhatsNewRoute', () => {
  setupFakeTimersPerTest();

  beforeEach(() => {
    jest.mocked(router.back).mockClear();
    jest.mocked(router.dismissTo).mockClear();
  });

  describe('1.17.0 소개', () => {
    it.each(['auto', 'mypage'])(
      '%s에서 열면 이 계정·캠페인을 본 것으로 남기고 캠페인 노출을 한 번 남긴다',
      async (source) => {
        // When
        const { di, countEvents } = await renderWhatsNew({
          releaseId: RELEASE_1_17_0.id,
          source,
        });

        // Then
        expect(di.whatsNewRepository.hasSeen(CAMPAIGN_IDENTITY)).toBe(true);
        expect(countEvents('feature_hub_impression')).toEqual([
          ['feature_hub_impression', { campaign_id: RELEASE_1_17_0.campaignId, source }],
        ]);
      },
    );

    it('다음을 누르면 단계를 차례로 넘기고 단계마다 한 번씩 남긴다', async () => {
      // Given
      const { getViewedSteps } = await renderWhatsNew({
        releaseId: RELEASE_1_17_0.id,
        source: 'auto',
      });

      // When
      await goToFinish(6);

      // Then
      expect(getViewedSteps()).toEqual([
        ['intro', 0],
        ['chooseCalendars', 1],
        ['mapCategories', 2],
        ['importing', 3],
        ['plans', 4],
        ['finish', 5],
      ]);
      expect(screen.getByTestId('whats-new-later')).toBeOnTheScreen();
    });

    it('뒤로 가면 앞 단계를 다시 보이고 다시 넘겨도 단계를 다시 세지 않는다', async () => {
      // Given
      const { getViewedSteps } = await renderWhatsNew({
        releaseId: RELEASE_1_17_0.id,
        source: 'auto',
      });
      await pressNext();
      await pressNext();

      // When
      await pressBack();

      // Then
      expect(screen.getByText('가져올 캘린더만 골라요')).toBeOnTheScreen();
      await pressNext();
      expect(getViewedSteps()).toEqual([
        ['intro', 0],
        ['chooseCalendars', 1],
        ['mapCategories', 2],
      ]);
    });

    it('소개 카드를 누르면 다음 단계로 넘어간다', async () => {
      // Given
      const { getViewedSteps } = await renderWhatsNew({
        releaseId: RELEASE_1_17_0.id,
        source: 'auto',
      });

      // When
      await fireEvent.press(screen.getByTestId('whats-new-intro-todo-import'));
      await act(() => jest.advanceTimersByTimeAsync(TAP_GUARD_MS));

      // Then
      expect(getViewedSteps()).toEqual([
        ['intro', 0],
        ['chooseCalendars', 1],
      ]);
    });

    it('마무리에서 나중에 하기를 누르면 완료를 한 번 남기고 닫으며 닫힘은 남기지 않는다', async () => {
      // Given
      const { countEvents, unmount, di } = await renderWhatsNew({
        releaseId: RELEASE_1_17_0.id,
        source: 'auto',
      });
      await goToFinish(6);

      // When
      await fireEvent.press(screen.getByTestId('whats-new-later'));
      await unmount();

      // Then
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(countEvents('whats_new_completed')).toEqual([
        ['whats_new_completed', { release_id: RELEASE_1_17_0.id, source: 'auto' }],
      ]);
      expect(countEvents('feature_hub_dismissed')).toEqual([]);
      expect(di.whatsNewRepository.hasSeen(CAMPAIGN_IDENTITY)).toBe(true);
    });

    it('헤더의 닫기로 닫으면 화면이 내려갈 때 닫힘을 한 번 남기고 완료는 남기지 않는다', async () => {
      // Given
      const { countEvents, unmount } = await renderWhatsNew({
        releaseId: RELEASE_1_17_0.id,
        source: 'auto',
      });
      await pressNext();

      // When
      await fireEvent.press(screen.getByLabelText('닫기'));
      await unmount();

      // Then
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(countEvents('feature_hub_dismissed')).toEqual([
        ['feature_hub_dismissed', { campaign_id: RELEASE_1_17_0.campaignId, source: 'auto' }],
      ]);
      expect(countEvents('whats_new_completed')).toEqual([]);
    });

    it('마무리의 일정 가져오기 카드는 흐름을 닫고 그 화면을 열며 누름을 한 번씩 남긴다', async () => {
      // Given
      const { countEvents, unmount } = await renderWhatsNew({
        releaseId: RELEASE_1_17_0.id,
        source: 'auto',
      });
      await goToFinish(6);

      // When
      await fireEvent.press(screen.getByTestId('whats-new-open-todo-import'));
      await unmount();

      // Then
      expect(router.dismissTo).toHaveBeenCalledWith('/todo-import', undefined);
      expect(countEvents('whats_new_cta_pressed')).toEqual([
        ['whats_new_cta_pressed', { release_id: RELEASE_1_17_0.id, step: 'finish' }],
      ]);
      expect(countEvents('feature_card_cta')).toEqual([
        [
          'feature_card_cta',
          {
            campaign_id: RELEASE_1_17_0.campaignId,
            feature: 'calendar_import',
            source: 'auto',
          },
        ],
      ]);
      expect(countEvents('feature_hub_dismissed')).toEqual([]);
    });

    it('예시 장면을 눌러 보아도 서버에 쓰지 않고 요금제만 읽는다', async () => {
      // Given
      const { httpClient } = await renderWhatsNew({
        releaseId: RELEASE_1_17_0.id,
        source: 'auto',
      });
      await pressNext();
      await act(() => jest.runOnlyPendingTimersAsync());

      // When
      // 예시 장면은 읽기 도구에서 숨겨 숨은 요소까지 찾는다
      await fireEvent.press(screen.getByText('개인', HIDDEN));
      await pressNext();
      await act(() => jest.runOnlyPendingTimersAsync());
      await fireEvent.press(screen.getByText('공부', HIDDEN));
      await pressNext();
      await act(() => jest.advanceTimersByTimeAsync(5_000));
      await fireEvent.press(screen.getByLabelText('전공 수업', HIDDEN));
      await pressNext();
      await act(() => jest.runOnlyPendingTimersAsync());

      // Then
      expect(screen.getByText('무료')).toBeOnTheScreen();
      expect(httpClient.post).not.toHaveBeenCalled();
      expect(httpClient.patch).not.toHaveBeenCalled();
      expect(httpClient.delete).not.toHaveBeenCalled();
      expect(uniq(httpClient.get.mock.calls.map(([path]) => path))).toEqual(['v1/entitlements']);
    });
  });

  describe('1.16.0 소개', () => {
    it('캠페인이 없는 출시라 본 기록과 캠페인 지표 없이 단계를 차례로 넘긴다', async () => {
      // Given
      const { getViewedSteps, countEvents, di } = await renderWhatsNew({
        releaseId: RELEASE_1_16_0.id,
        source: 'mypage',
      });

      // When
      await goToFinish(7);

      // Then
      expect(getViewedSteps()).toEqual([
        ['intro', 0],
        ['suggestionRequest', 1],
        ['suggestionList', 2],
        ['reportSummary', 3],
        ['reportHours', 4],
        ['freeRecord', 5],
        ['finish', 6],
      ]);
      expect(countEvents('feature_hub_impression')).toEqual([]);
      expect(di.whatsNewRepository.hasSeen(CAMPAIGN_IDENTITY)).toBe(false);
    });

    it('소개에서 리포트 카드를 누르면 리포트 장면으로 건너뛰고 뒤로 가면 소개로 돌아온다', async () => {
      // Given
      const { getViewedSteps } = await renderWhatsNew({
        releaseId: RELEASE_1_16_0.id,
        source: 'mypage',
      });

      // When
      await fireEvent.press(screen.getByTestId('whats-new-intro-report'));
      await act(() => jest.advanceTimersByTimeAsync(TAP_GUARD_MS));
      await pressBack();

      // Then
      expect(getViewedSteps()).toEqual([
        ['intro', 0],
        ['reportSummary', 3],
      ]);
      expect(screen.getByTestId('whats-new-intro-report')).toBeOnTheScreen();
    });
  });

  it('소개가 없는 출시로 들어온 링크는 최신 소개를 연다', async () => {
    // When
    const { getViewedSteps } = await renderWhatsNew({ releaseId: '1.15.0', source: 'mypage' });

    // Then
    expect(screen.getByTestId('whats-new-intro-todo-import')).toBeOnTheScreen();
    expect(getViewedSteps()).toEqual([['intro', 0]]);
  });
});
