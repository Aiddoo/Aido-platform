import { ApiError } from '@src/core/errors/api-error';
import '@src/shared/i18n/init';
import { err } from '@src/core/errors/result';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { ServerError } from '@src/shared/errors';
import { QueryErrorBoundary } from '@src/shared/ui';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { SuggestionEntry } from './suggestion-entry';

const RETRY_LABEL = '맞춤 제안을 불러오지 못했어요. 눌러서 다시 확인해주세요';
const PREMIUM_ONLY_LABEL = 'AI 반복 제안은 프리미엄 구독자만 이용할 수 있어요';

// 실제 클라이언트처럼 4xx는 Result.err로 돌려주고 5xx는 ServerError로 던진다
function renderFeedEntry(
  { isPremiumCached }: { isPremiumCached: boolean },
  error: ApiError | ServerError,
) {
  const httpClient = createHttpClientStub();
  if (error instanceof ServerError) {
    httpClient.get.mockRejectedValue(error);
  } else {
    httpClient.get.mockResolvedValue(err(error));
  }
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1', name: '아이도' }));
  if (isPremiumCached) {
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ tier: 'PREMIUM' }),
    );
  }

  return renderScreen(
    <QueryErrorBoundary fallback={SuggestionEntry.Error}>
      <Suspense fallback={<SuggestionEntry.Loading />}>
        <SuggestionEntry />
      </Suspense>
    </QueryErrorBoundary>,
    {
      di: createTestDi({
        ports: { httpClient, errorReporter: createErrorReporterStub(), queryClient },
      }),
    },
  );
}

describe('SuggestionEntry', () => {
  it.each([
    { case: '제안', isPremiumCached: true },
    { case: '한도 스냅샷', isPremiumCached: false },
  ])(
    '$case 조회가 실패하면 피드를 막지 않고 칸 안에서 다시 시도를 보인다',
    async ({ isPremiumCached }) => {
      // When
      await renderFeedEntry({ isPremiumCached }, new ServerError(500));

      // Then
      expect(await screen.findByText(RETRY_LABEL)).toBeTruthy();
    },
  );

  it('프리미엄으로 알았지만 서버가 제안을 거절하면 다시 시도 대신 결제 안내를 보인다', async () => {
    // When
    await renderFeedEntry({ isPremiumCached: true }, new ApiError('AI_1309', '프리미엄 전용', 403));

    // Then
    expect(await screen.findByText(PREMIUM_ONLY_LABEL)).toBeTruthy();
  });
});
