import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import { createHttpClientStub, createPendingResponse, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useMutation, useQuery } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';

import { createSuggestionDto } from '../__tests__/suggestion.fixtures';
import { useActOnSuggestionMutationOptions } from './suggestion.mutations';
import { useGetSuggestionsQueryOptions } from './suggestion.queries';

const SUGGESTION = createSuggestionDto({ id: 7 });

async function setup(actResponse: Result<unknown, ApiError>) {
  const httpClient = createHttpClientStub();
  const refetched = createPendingResponse(ok({ suggestions: [] }));
  // 처리를 보낸 뒤의 목록 다시 받기만 붙잡아 둔다
  httpClient.get.mockImplementation(async () =>
    httpClient.patch.mock.calls.length === 0
      ? ok({ suggestions: [SUGGESTION] })
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
      result.current.act.mutate({ suggestionId: 7, input: { action: 'dismiss' } }),
    );

    // Then
    await waitFor(() => expect(result.current.suggestions.isFetching).toBe(true));
    expect(result.current.act.isPending).toBe(true);
    await act(async () => finishRefetch());
    await waitFor(() => expect(result.current.act.isSuccess).toBe(true));
    expect(result.current.suggestions.data).toEqual([]);
  });

  it('실패하면 목록을 다시 받되 끝나기를 기다리지 않아 오프라인에도 버튼이 풀린다', async () => {
    // Given
    const { result, finishRefetch } = await setup(
      err(new ApiError('AI_1305', '이미 처리한 제안', 409)),
    );

    // When
    await act(async () =>
      result.current.act.mutate({ suggestionId: 7, input: { action: 'dismiss' } }),
    );

    // Then
    await waitFor(() => expect(result.current.act.isError).toBe(true));
    expect(result.current.suggestions.isFetching).toBe(true);
    await act(async () => finishRefetch());
  });
});
