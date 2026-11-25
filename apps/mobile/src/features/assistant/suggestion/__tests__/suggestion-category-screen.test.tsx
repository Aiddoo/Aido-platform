/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  countGetRequests,
  layoutSheetRoute,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { getTrackedEvents } from '@src/features/weather/__tests__/weather.test-utils';
import { ServerError } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createRouteParamsFake,
  createTestDi,
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
}: {
  params?: Record<string, string>;
  httpClient?: ReturnType<typeof createSuggestionHttpClient>;
} = {}) {
  createRouteParamsFake(params);
  const analytics = createAnalyticsStub();
  const { queryClient } = await renderScreen(<SuggestionCategorySheetRoute />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await layoutSheetRoute();
  return { httpClient, analytics, queryClient };
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
    expect(countWriteRequests(httpClient, 'patch', SUGGESTION_PATH)).toBe(2);
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

  it('목록에 없는 제안이면 수락하지 않고 시트를 닫는다', async () => {
    // When
    const { httpClient } = await renderCategorySheet({ params: { suggestionId: '404' } });

    // Then
    await waitFor(() => expect(countGetRequests(httpClient)['v1/ai/suggestions']).toBe(1));
    expect(screen.queryByTestId('category-select-submit')).not.toBeOnTheScreen();
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
});
