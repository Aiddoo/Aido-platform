/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import { createLimitApiError } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import {
  countGetRequests,
  layoutSheetRoute,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { ServerError } from '@src/shared/errors';
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

import SuggestionCategorySheetRoute from '../../../../../app/(app)/suggestions/[suggestionId]/category';
import { SUGGESTION_QUERY_KEYS } from '../queries/suggestion-query-keys';
import { createSuggestionDto, createSuggestionListDto } from './suggestion.fixtures';
import {
  countWriteRequests,
  createSuggestionHttpClient,
  SUGGESTION_NOW,
} from './suggestion.test-utils';

setupFakeTimersPerTest({ now: SUGGESTION_NOW, doNotFake: ['nextTick'] });

const STRETCHING = createSuggestionDto({ id: 1, daysOfWeek: ['MON', 'WED'] });
const SUGGESTION_PATH = 'v1/ai/suggestions/1';

async function renderCategorySheet({
  params = { suggestionId: '1' },
  httpClient = createSuggestionHttpClient({
    list: createSuggestionListDto({ suggestions: [STRETCHING] }),
  }),
  haptics = createHapticsGatewayStub(),
}: {
  params?: Record<string, string>;
  httpClient?: ReturnType<typeof createSuggestionHttpClient>;
  haptics?: ReturnType<typeof createHapticsGatewayStub>;
} = {}) {
  createRouteParamsFake(params);
  const analytics = createAnalyticsStub();
  const { queryClient, unmount } = await renderScreen(<SuggestionCategorySheetRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, haptics } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await layoutSheetRoute();
  return { httpClient, analytics, queryClient, unmount };
}

describe('SuggestionCategorySheetRoute', () => {
  it('고른 카테고리로 한 번 수락해 반복 할 일을 만들고, 목록과 할 일 카테고리를 다시 받는다', async () => {
    // Given
    let list = createSuggestionListDto({ suggestions: [STRETCHING] });
    const httpClient = createSuggestionHttpClient({ list: () => list });
    httpClient.patch.mockImplementation(async () => {
      list = createSuggestionListDto({ suggestions: [] });
      return ok({ message: '만들었어요', suggestion: { ...STRETCHING, status: 'ACCEPTED' } });
    });
    const { analytics, queryClient } = await renderCategorySheet({
      httpClient,
      params: { suggestionId: '1', source: 'report_preview' },
    });
    const submit = await screen.findByTestId('category-select-submit');
    const categoryRequestsBefore = countGetRequests(httpClient)['v1/todo-categories'];

    // When
    await act(async () => {
      await fireEvent.press(screen.getByRole('radio', { name: '업무' }));
    });
    await act(async () => {
      await fireEvent.press(submit);
      await fireEvent.press(submit);
    });

    // Then
    await waitFor(() =>
      expect(queryClient.getQueryData(SUGGESTION_QUERY_KEYS.list())?.suggestions).toEqual([]),
    );
    expect(httpClient.patch).toHaveBeenCalledWith(SUGGESTION_PATH, {
      action: 'accept',
      categoryId: 2,
    });
    expect(countWriteRequests(httpClient, 'patch', SUGGESTION_PATH)).toBe(1);
    expect(await screen.findAllByText('매주 월·수 반복으로 만들었어요')).not.toHaveLength(0);
    expect(countGetRequests(httpClient)['v1/todo-categories']).toBeGreaterThan(
      categoryRequestsBefore ?? 0,
    );
    expect(getTrackedEvents(analytics, 'ai_suggestion_acted')).toContainEqual({
      action: 'accept',
      source: 'report_preview',
    });
  });

  it('수락이 실패하면 제안을 목록에 그대로 두고 시트에 남아 다시 누를 수 있다', async () => {
    // Given
    const httpClient = createSuggestionHttpClient({
      list: createSuggestionListDto({ suggestions: [STRETCHING] }),
    });
    httpClient.patch.mockRejectedValue(new ServerError(500));
    const { queryClient } = await renderCategorySheet({ httpClient });
    const submit = await screen.findByTestId('category-select-submit');

    // When
    await act(async () => {
      await fireEvent.press(submit);
    });

    // Then
    await waitFor(() => expect(submit).toBeEnabled());
    expect(httpClient.patch).toHaveBeenCalledWith(SUGGESTION_PATH, {
      action: 'accept',
      categoryId: 1,
    });
    expect(
      queryClient.getQueryData(SUGGESTION_QUERY_KEYS.list())?.suggestions.map(({ id }) => id),
    ).toEqual([1]);
    expect(screen.getByTestId('category-select-submit')).toBeOnTheScreen();
  });

  describe('요금제로 거절되면', () => {
    it('프리미엄 기능이라고 알리고 오류 햅틱을 한 번 준다', async () => {
      // Given
      const httpClient = createSuggestionHttpClient({
        list: createSuggestionListDto({ suggestions: [STRETCHING] }),
      });
      httpClient.patch.mockResolvedValue(
        fail(createLimitApiError(ErrorCode.AI_1309, undefined, 403)),
      );
      const haptics = createHapticsGatewayStub();
      await renderCategorySheet({ httpClient, haptics });
      const submit = await screen.findByTestId('category-select-submit');

      // When
      await act(async () => {
        await fireEvent.press(submit);
      });

      // Then
      // 캐시가 아직 프리미엄이라 구독을 권하지 않고 제목을 토스트로 알린다
      expect(await screen.findByText('AI 제안은 프리미엄 기능이에요')).toBeOnTheScreen();
      expect(haptics.notify.mock.calls).toEqual([['error']]);
    });

    it('수락을 누르고 응답 전에 시트가 내려가도 요금제 안내 길을 타 오류 햅틱을 한 번 준다', async () => {
      // Given
      const httpClient = createSuggestionHttpClient({
        list: createSuggestionListDto({ suggestions: [STRETCHING] }),
      });
      const response = Promise.withResolvers<Result<unknown, ApiError>>();
      httpClient.patch.mockReturnValue(response.promise);
      const haptics = createHapticsGatewayStub();
      const { unmount } = await renderCategorySheet({ httpClient, haptics });
      const submit = await screen.findByTestId('category-select-submit');
      await act(async () => {
        await fireEvent.press(submit);
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

  it('목록에 없는 제안이면 수락하지 않고 시트를 닫는다', async () => {
    // When
    const { httpClient } = await renderCategorySheet({ params: { suggestionId: '404' } });

    // Then
    await waitFor(() => expect(countGetRequests(httpClient)['v1/ai/suggestions']).toBe(1));
    expect(screen.queryByTestId('category-select-submit')).not.toBeOnTheScreen();
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
});
