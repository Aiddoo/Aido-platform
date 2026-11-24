import '@src/shared/i18n/init';
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
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { RELEASE_1_16_0 } from '../constants/releases.constants';
import { Release1160Steps } from './release-1-16-0-steps';

const ACCOUNT_ID = 'user-1';
/** 다음 버튼은 연타를 한 번으로 본다(useSingleTap) */
const TAP_GUARD_MS = 600;

async function renderSteps() {
  jest.mocked(useLocalSearchParams).mockReturnValue({ source: 'auto' });
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), createPreference());

  const di = createTestDi({
    ports: {
      queryClient,
      // 앞에 있는 앱은 자정 타이머를 계속 걸어 runAllTimers가 끝나지 않는다
      appLifecycle: createAppLifecycleGatewayStub('background'),
      httpClient,
      analytics,
    },
  });
  const view = await renderScreen(<Release1160Steps />, {
    di,
    withLocalDate: true,
    withOverlay: true,
  });

  return { ...view, analytics, httpClient };
}

async function pressNext() {
  await fireEvent.press(screen.getByText('다음'));
  await act(() => jest.advanceTimersByTimeAsync(TAP_GUARD_MS));
}

async function goToFinish() {
  await fireEvent.press(screen.getByTestId('whats-new-intro-suggestion'));
  await act(() => jest.runAllTimersAsync());
  await fireEvent.press(screen.getByTestId('whats-new-request-now'));
  await act(() => jest.runAllTimersAsync());
  await pressNext();
  await act(() => jest.runAllTimersAsync());
  const [makeButton] = screen.getAllByText('반복으로 만들기');
  if (makeButton == null) {
    throw new Error('예시 제안의 반복으로 만들기 버튼이 없습니다');
  }
  await fireEvent.press(makeButton);
  await act(() => jest.advanceTimersByTimeAsync(TAP_GUARD_MS));
  await pressNext();
  await pressNext();
  await pressNext();
}

describe('Release1160Steps', () => {
  setupFakeTimersPerTest();

  beforeEach(() => {
    jest.mocked(router.dismissTo).mockClear();
  });

  it('캠페인이 없는 지난 출시라 열어도 캠페인 노출을 남기지 않고 단계만 센다', async () => {
    // When
    const { analytics } = await renderSteps();

    // Then
    const eventNames = jest.mocked(analytics.trackEvent).mock.calls.map(([eventName]) => eventName);
    expect(eventNames).not.toContain('feature_hub_impression');
    expect(analytics.trackEvent).toHaveBeenCalledWith('whats_new_step_viewed', {
      release_id: RELEASE_1_16_0.id,
      step: 'intro',
      index: 0,
      source: 'auto',
    });
  });

  it('예시의 지금 분석 받기·반복으로 만들기를 눌러도 서버를 부르지 않고 제안 지표를 남기지 않는다', async () => {
    // Given
    const { analytics, httpClient } = await renderSteps();

    // When
    await goToFinish();

    // Then
    expect(screen.getByTestId('whats-new-open-suggestions')).toBeOnTheScreen();
    expect(httpClient.get).not.toHaveBeenCalled();
    expect(httpClient.post).not.toHaveBeenCalled();
    const eventNames = jest.mocked(analytics.trackEvent).mock.calls.map(([eventName]) => eventName);
    expect(eventNames.filter((eventName) => eventName.startsWith('ai_'))).toEqual([]);
  });

  it.each([
    ['AI 제안', 'whats-new-open-suggestions', '/suggestions'],
    ['AI 리포트', 'whats-new-open-reports', '/reports'],
  ] as const)('마무리의 %s 카드는 흐름을 닫고 그 화면을 연다', async (_label, testID, href) => {
    // Given
    const { analytics } = await renderSteps();
    await goToFinish();

    // When
    await fireEvent.press(screen.getByTestId(testID));

    // Then
    expect(router.dismissTo).toHaveBeenCalledWith(href, undefined);
    expect(analytics.trackEvent).toHaveBeenCalledWith('whats_new_cta_pressed', {
      release_id: RELEASE_1_16_0.id,
      step: 'finish',
    });
  });
});
