import { ApiError } from '@src/core/errors/api-error';
import '@src/shared/i18n/init';
import { err } from '@src/core/errors/result';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { screen } from '@testing-library/react-native';

import { SuggestionEntry } from './suggestion-entry';

const RETRY_LABEL = '맞춤 제안을 불러오지 못했어요. 눌러서 다시 확인해주세요';
const serverError = () => err(new ApiError('SYS_0001', '서버 오류', 500));

function createQueryClient() {
  return createTestQueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
}

describe('SuggestionEntry', () => {
  it('제안 API가 실패해도 오류를 던지지 않고 칸 안에서 다시 시도를 보인다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(serverError());
    const queryClient = createQueryClient();
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1', name: '아이도' }));
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ tier: 'PREMIUM' }),
    );

    // When
    await renderUi(<SuggestionEntry />, {
      di: { httpClient, errorReporter: createErrorReporterStub() },
      queryClient,
    });

    // Then
    expect(await screen.findByText(RETRY_LABEL)).toBeTruthy();
  });

  it('한도 스냅샷을 읽지 못해도 오류를 던지지 않고 칸 안에서 다시 시도를 보인다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(serverError());
    const queryClient = createQueryClient();
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1', name: '아이도' }));

    // When
    await renderUi(<SuggestionEntry />, {
      di: { httpClient, errorReporter: createErrorReporterStub() },
      queryClient,
    });

    // Then
    expect(await screen.findByText(RETRY_LABEL)).toBeTruthy();
  });
});
