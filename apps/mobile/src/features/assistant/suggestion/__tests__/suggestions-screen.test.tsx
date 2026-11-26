/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import type { AiSuggestionAnalysisState } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import { createLimitApiError } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createRouteParamsFake,
  createTestDi,
  getTrackedEvents,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import SuggestionsScreen from '../../../../../app/(app)/suggestions/index';
import {
  createSuggestionAnalysisDto,
  createSuggestionDto,
  createSuggestionListDto,
} from './suggestion.fixtures';
import {
  countWriteRequests,
  createSuggestionHttpClient,
  SUGGESTION_NOW,
} from './suggestion.test-utils';

setupFakeTimersPerTest({ now: SUGGESTION_NOW, doNotFake: ['nextTick'] });

const STRETCHING = createSuggestionDto({ id: 1, title: '아침 스트레칭' });
/** 캐시가 아직 프리미엄인데 서버가 요금제로 막으면 구독을 권하지 않고 이 제목을 토스트로 알린다 */
const PREMIUM_ONLY_TITLE = 'AI 제안은 프리미엄 기능이에요';

async function renderSuggestions(
  httpClient = createSuggestionHttpClient(),
  haptics = createHapticsGatewayStub(),
) {
  createRouteParamsFake({});
  const analytics = createAnalyticsStub();
  const { unmount } = await renderScreen(<SuggestionsScreen />, {
    di: createTestDi({ ports: { httpClient, analytics, haptics } }),
    withLocalDate: true,
    withOverlay: true,
  });
  return { httpClient, analytics, unmount };
}

function createListInState(state: AiSuggestionAnalysisState, canRequestNow = false) {
  return createSuggestionListDto({
    suggestions: [],
    analysis: createSuggestionAnalysisDto({ state, canRequestNow }),
  });
}

describe('SuggestionsScreen', () => {
  it.each([
    { state: 'ANALYZING', title: '최근 할 일을 살펴보고 있어요' },
    { state: 'NO_PATTERN_FOUND', title: '아직 반복할 만한 할 일이 없어요' },
    { state: 'DONE_FOR_TODAY', title: '오늘 제안을 모두 확인했어요' },
    { state: 'NEEDS_AI_CONSENT', title: 'AI 제안을 받으려면 동의가 필요해요' },
    { state: 'NEEDS_MORE_TODOS', title: '아직 살펴볼 할 일이 없어요' },
  ] as const)(
    '분석 상태가 $state이면 그 안내를 보이고 열 때 한 번 남긴다',
    async ({ state, title }) => {
      // When
      const { analytics } = await renderSuggestions(
        createSuggestionHttpClient({ list: createListInState(state) }),
      );

      // Then
      expect(await screen.findByText(title)).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: '반복으로 만들기' })).not.toBeOnTheScreen();
      expect(getTrackedEvents(analytics, 'ai_suggestions_viewed')).toEqual([
        { state, suggestion_count: 0 },
      ]);
    },
  );

  it('제안이 있으면 개수와 함께 행마다 반복 요일·시각과 근거를 보인다', async () => {
    // When
    await renderSuggestions();

    // Then
    expect(await screen.findByText('자주 하는 할 일 1개를 찾았어요')).toBeOnTheScreen();
    expect(screen.getByText('아침 스트레칭')).toBeOnTheScreen();
    expect(screen.getByText('최근 2주 9번 중 8번 끝냈어요')).toBeOnTheScreen();
    expect(screen.getByText('매주 월·수')).toBeOnTheScreen();
    expect(screen.getByText('오전 7:30')).toBeOnTheScreen();
  });

  it.each([
    { daysOfWeek: ['SUN'], scheduledTime: '06:00', repeat: '매주 일', time: '오전 6:00' },
    {
      daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      scheduledTime: '21:00',
      repeat: '매일',
      time: '오후 9:00',
    },
  ] as const)(
    '$daysOfWeek 제안은 만들 할 일의 반복을 $repeat로 보인다',
    async ({ daysOfWeek, scheduledTime, repeat, time }) => {
      // When
      await renderSuggestions(
        createSuggestionHttpClient({
          list: createSuggestionListDto({
            suggestions: [createSuggestionDto({ daysOfWeek: [...daysOfWeek], scheduledTime })],
          }),
        }),
      );

      // Then
      expect(await screen.findByText(repeat)).toBeOnTheScreen();
      expect(screen.getByText(time)).toBeOnTheScreen();
    },
  );

  it('지금 분석 받기를 누르면 분석을 요청하고 분석 중 안내로 바꾼다', async () => {
    // Given
    const httpClient = createSuggestionHttpClient({
      list: createListInState('WAITING_FOR_NEXT_RUN', true),
    });
    httpClient.post.mockResolvedValue(
      ok({ analysis: createSuggestionAnalysisDto({ state: 'ANALYZING', canRequestNow: false }) }),
    );
    const { analytics } = await renderSuggestions(httpClient);
    const request = await screen.findByRole('button', { name: '지금 분석 받기' });

    // When
    await act(async () => {
      await fireEvent.press(request);
      await fireEvent.press(request);
    });

    // Then
    expect(await screen.findByText('최근 할 일을 살펴보고 있어요')).toBeOnTheScreen();
    expect(countWriteRequests(httpClient, 'post', 'v1/ai/suggestions/analyses')).toBe(1);
    expect(getTrackedEvents(analytics, 'ai_suggestion_analysis_requested')).toHaveLength(1);
  });

  it('필요 없어요를 누르면 그 제안을 거절하고 다시 받은 목록에서 행을 뺀다', async () => {
    // Given
    let list = createSuggestionListDto({ suggestions: [STRETCHING] });
    const httpClient = createSuggestionHttpClient({ list: () => list });
    httpClient.patch.mockImplementation(async () => {
      list = createListInState('DONE_FOR_TODAY');
      return ok({ message: '거절했어요', suggestion: { ...STRETCHING, status: 'DISMISSED' } });
    });
    const { analytics } = await renderSuggestions(httpClient);
    const dismiss = await screen.findByRole('button', { name: '필요 없어요' });

    // When
    await act(async () => {
      await fireEvent.press(dismiss);
      await fireEvent.press(dismiss);
    });

    // Then
    expect(await screen.findByText('오늘 제안을 모두 확인했어요')).toBeOnTheScreen();
    expect(screen.queryByText('아침 스트레칭')).not.toBeOnTheScreen();
    expect(httpClient.patch).toHaveBeenCalledWith('v1/ai/suggestions/1', { action: 'dismiss' });
    expect(countWriteRequests(httpClient, 'patch', 'v1/ai/suggestions/1')).toBe(1);
    await waitFor(() =>
      expect(getTrackedEvents(analytics, 'ai_suggestion_acted')).toContainEqual({
        action: 'dismiss',
        source: 'suggestions_screen',
      }),
    );
  });

  it('서로 다른 두 줄의 필요 없어요를 연달아 눌러도 두 제안을 모두 거절한다', async () => {
    // Given
    const httpClient = createSuggestionHttpClient({
      list: createSuggestionListDto({
        suggestions: [STRETCHING, createSuggestionDto({ id: 2, title: '저녁 산책' })],
      }),
    });
    httpClient.patch.mockReturnValue(new Promise(() => undefined));
    await renderSuggestions(httpClient);
    const [firstDismiss, secondDismiss] = await screen.findAllByRole('button', {
      name: '필요 없어요',
    });
    if (firstDismiss == null || secondDismiss == null) {
      throw new Error('두 줄의 필요 없어요 버튼이 없습니다');
    }

    // When
    await act(async () => {
      await fireEvent.press(firstDismiss);
      await fireEvent.press(secondDismiss);
    });

    // Then
    expect(httpClient.patch.mock.calls).toEqual([
      ['v1/ai/suggestions/1', { action: 'dismiss' }],
      ['v1/ai/suggestions/2', { action: 'dismiss' }],
    ]);
  });

  describe('거절이 요금제로 막히면', () => {
    it('프리미엄 기능이라고 알리고 오류 햅틱을 한 번 준다', async () => {
      // Given
      const httpClient = createSuggestionHttpClient();
      httpClient.patch.mockResolvedValue(
        fail(createLimitApiError(ErrorCode.AI_1309, undefined, 403)),
      );
      const haptics = createHapticsGatewayStub();
      await renderSuggestions(httpClient, haptics);
      const dismiss = await screen.findByRole('button', { name: '필요 없어요' });

      // When
      await act(async () => {
        await fireEvent.press(dismiss);
      });

      // Then
      expect(await screen.findByText(PREMIUM_ONLY_TITLE)).toBeOnTheScreen();
      expect(haptics.notify.mock.calls).toEqual([['error']]);
    });

    it('누르고 응답 전에 화면을 떠나도 요금제 안내 길을 타 오류 햅틱을 한 번 준다', async () => {
      // Given
      const httpClient = createSuggestionHttpClient();
      const response = Promise.withResolvers<Result<unknown, ApiError>>();
      httpClient.patch.mockReturnValue(response.promise);
      const haptics = createHapticsGatewayStub();
      const { unmount } = await renderSuggestions(httpClient, haptics);
      const dismiss = await screen.findByRole('button', { name: '필요 없어요' });
      await act(async () => {
        await fireEvent.press(dismiss);
      });

      // When
      await unmount();
      await act(async () => {
        response.resolve(fail(createLimitApiError(ErrorCode.AI_1309, undefined, 403)));
        await jest.advanceTimersByTimeAsync(0);
      });

      // Then
      // 햅틱은 안내 함수가 한도·요금제 거절로 판정했을 때만 울린다
      await waitFor(() => expect(haptics.notify.mock.calls).toEqual([['error']]));
    });
  });

  it('반복으로 만들기를 같은 프레임에 두 번 눌러도 그 제안의 카테고리 시트를 한 번 연다', async () => {
    // Given
    await renderSuggestions();
    const make = await screen.findByRole('button', { name: '반복으로 만들기' });

    // When
    await act(async () => {
      await fireEvent.press(make);
      await fireEvent.press(make);
    });

    // Then
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/suggestions/[suggestionId]/category',
      params: { suggestionId: 1 },
    });
  });

  it('무료는 제안을 묻지 않고 예시 제안을 보이며 어느 버튼이든 제안 결제 화면을 연다', async () => {
    // Given
    const { httpClient } = await renderSuggestions(createSuggestionHttpClient({ tier: 'FREE' }));
    const [exampleMake] = await screen.findAllByRole('button', { name: '반복으로 만들기' });
    if (exampleMake == null) {
      throw new Error('예시 제안의 만들기 버튼이 없습니다');
    }

    // When
    await act(async () => {
      await fireEvent.press(exampleMake);
    });

    // Then
    expect(screen.getByText('영양제 먹기')).toBeOnTheScreen();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { feature: 'AI_SUGGESTION' },
    });
    expect(countGetRequests(httpClient)).not.toHaveProperty(['v1/ai/suggestions']);
  });
});
