import '@src/shared/i18n/init';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  createApiError,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useMutation, useQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';

import {
  createSuggestionAnalysisDto,
  createSuggestionDto,
  createSuggestionListDto,
} from '../__tests__/suggestion.fixtures';
import {
  useActOnSuggestionMutationOptions,
  useRequestSuggestionAnalysisMutationOptions,
} from './suggestion.mutations';
import { useGetSuggestionsQueryOptions } from './suggestion.queries';

const SUGGESTION = createSuggestionDto({ id: 7 });

async function setup(actResponse: Result<unknown, ApiError>) {
  const httpClient = createHttpClientStub();
  const refetched = createPendingResponse(ok(createSuggestionListDto({ suggestions: [] })));
  // 처리를 보낸 뒤의 목록 다시 받기만 붙잡아 둔다
  httpClient.get.mockImplementation(async () =>
    httpClient.patch.mock.calls.length === 0
      ? ok(createSuggestionListDto({ suggestions: [SUGGESTION] }))
      : refetched.response,
  );
  httpClient.patch.mockResolvedValue(actResponse);
  const rendered = await renderScreenHook(
    () => ({
      suggestions: useQuery(useGetSuggestionsQueryOptions()),
      act: useMutation(useActOnSuggestionMutationOptions()),
    }),
    { di: createTestDi({ ports: { httpClient } }), withOverlay: true, withLocalDate: true },
  );
  await waitFor(() => expect(rendered.result.current.suggestions.isSuccess).toBe(true));
  return { ...rendered, finishRefetch: refetched.settle };
}

describe('useActOnSuggestionMutationOptions', () => {
  it('거절은 다시 받은 목록에서 행이 사라질 때까지 진행 중으로 남는다', async () => {
    // Given
    const { result, finishRefetch } = await setup(
      ok({ message: '거절했어요', suggestion: { ...SUGGESTION, status: 'DISMISSED' } }),
    );

    // When
    await act(async () =>
      result.current.act.mutate({
        suggestionId: 7,
        input: { action: 'dismiss' },
        source: 'suggestions_screen',
      }),
    );

    // Then
    await waitFor(() => expect(result.current.suggestions.isFetching).toBe(true));
    expect(result.current.act.isPending).toBe(true);
    await act(async () => finishRefetch());
    await waitFor(() => expect(result.current.act.isSuccess).toBe(true));
    expect(result.current.suggestions.data?.suggestions).toEqual([]);
  });

  it('실패하면 목록을 다시 받되 끝나기를 기다리지 않아 오프라인에도 버튼이 풀린다', async () => {
    // Given
    const { result, finishRefetch } = await setup(
      fail(createApiError('AI_1305', { message: '이미 처리한 제안', status: 409 })),
    );

    // When
    await act(async () =>
      result.current.act.mutate({
        suggestionId: 7,
        input: { action: 'dismiss' },
        source: 'suggestions_screen',
      }),
    );

    // Then
    await waitFor(() => expect(result.current.act.isError).toBe(true));
    expect(result.current.suggestions.isFetching).toBe(true);
    await act(async () => finishRefetch());
  });
});

describe('useRequestSuggestionAnalysisMutationOptions', () => {
  it('요청 전부터 받던 목록이 늦게 와도 응답으로 쓴 분석 중 상태를 덮지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const waiting = createSuggestionListDto({
      suggestions: [],
      analysis: createSuggestionAnalysisDto({ state: 'WAITING_FOR_NEXT_RUN', canRequestNow: true }),
    });
    const staleRefetch = createPendingResponse(ok(waiting));
    httpClient.get
      .mockResolvedValueOnce(ok(waiting))
      .mockImplementation(async () => staleRefetch.response);
    httpClient.post.mockResolvedValue(
      ok({ analysis: createSuggestionAnalysisDto({ state: 'ANALYZING', canRequestNow: false }) }),
    );
    const { result } = await renderScreenHook(
      () => ({
        suggestions: useQuery(useGetSuggestionsQueryOptions()),
        request: useMutation(useRequestSuggestionAnalysisMutationOptions()),
      }),
      { di: createTestDi({ ports: { httpClient } }), withOverlay: true, withLocalDate: true },
    );
    await waitFor(() => expect(result.current.suggestions.isSuccess).toBe(true));
    await act(async () => {
      result.current.suggestions.refetch().catch(() => null);
    });

    // When
    await act(async () => result.current.request.mutate());
    await waitFor(() => expect(result.current.request.isSuccess).toBe(true));
    await act(async () => staleRefetch.settle());

    // Then
    await waitFor(() => expect(result.current.suggestions.isFetching).toBe(false));
    expect(httpClient.post).toHaveBeenCalledWith('v1/ai/suggestions/analyses');
    expect(result.current.suggestions.data?.analysis?.state).toBe('ANALYZING');
  });

  it('서버에 닿지 않으면 알리고 목록 다시 받기를 기다리지 않아 버튼을 바로 다시 누를 수 있다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const refetched = createPendingResponse(ok(createSuggestionListDto({ suggestions: [] })));
    httpClient.get.mockImplementation(async () =>
      httpClient.post.mock.calls.length === 0
        ? ok(createSuggestionListDto({ suggestions: [] }))
        : refetched.response,
    );
    httpClient.post.mockRejectedValue(new NetworkError());
    const { result } = await renderScreenHook(
      () => ({
        suggestions: useQuery(useGetSuggestionsQueryOptions()),
        request: useMutation(useRequestSuggestionAnalysisMutationOptions()),
      }),
      { di: createTestDi({ ports: { httpClient } }), withOverlay: true, withLocalDate: true },
    );
    await waitFor(() => expect(result.current.suggestions.isSuccess).toBe(true));

    // When
    await act(async () => result.current.request.mutate());

    // Then
    await waitFor(() => expect(result.current.request.isError).toBe(true));
    expect(result.current.suggestions.isFetching).toBe(true);
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    await act(async () => refetched.settle());
  });
});
