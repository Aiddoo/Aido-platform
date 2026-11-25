/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import type { AiSuggestionAnalysisState } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { getTrackedEvents } from '@src/features/weather/__tests__/weather.test-utils';
import {
  createAnalyticsStub,
  createRouteParamsFake,
  createTestDi,
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

async function renderSuggestions(httpClient = createSuggestionHttpClient()) {
  createRouteParamsFake({});
  const analytics = createAnalyticsStub();
  await renderScreen(<SuggestionsScreen />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });
  return { httpClient, analytics };
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
    { state: 'DONE_FOR_TODAY', title: '오늘 제안을 모두 정리했어요' },
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
    expect(countWriteRequests(httpClient, 'post', 'v1/ai/suggestions/analyses')).toBe(2);
    expect(getTrackedEvents(analytics, 'ai_suggestion_analysis_requested')).toHaveLength(2);
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
    expect(await screen.findByText('오늘 제안을 모두 정리했어요')).toBeOnTheScreen();
    expect(screen.queryByText('아침 스트레칭')).not.toBeOnTheScreen();
    expect(httpClient.patch).toHaveBeenCalledWith('v1/ai/suggestions/1', { action: 'dismiss' });
    expect(countWriteRequests(httpClient, 'patch', 'v1/ai/suggestions/1')).toBe(2);
    await waitFor(() =>
      expect(getTrackedEvents(analytics, 'ai_suggestion_acted')).toContainEqual({
        action: 'dismiss',
        source: 'suggestions_screen',
      }),
    );
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
