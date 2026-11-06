import '@src/shared/i18n/init';
import { AiService } from '@src/features/ai/apis/ai.service';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.factories';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/constants/entitlement-query-keys';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createErrorReporterStub, createMockHttpClient } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ApiError } from '@src/shared/errors/api-error';
import { err } from '@src/shared/errors/result';
import { screen } from '@testing-library/react-native';

import { SuggestionEntry } from './suggestion-entry';

const RETRY_LABEL = '맞춤 제안을 불러오지 못했어요. 눌러서 다시 확인해주세요';
const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const serverError = () => err(new ApiError('SYS_0001', '서버 오류', 500));

function createQueryClient() {
  return createTestQueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
}

describe('SuggestionEntry', () => {
  test('제안 API가 실패해도 오류를 던지지 않고 칸 안에서 다시 시도를 보인다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue(serverError());
    const queryClient = createQueryClient();
    queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'account-1', name: '아이도' });
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ tier: 'PREMIUM' }),
    );

    // When
    await renderUi(<SuggestionEntry />, {
      di: {
        aiService: new AiService(httpClient, silentLogger),
        entitlementService: new EntitlementService(httpClient, silentLogger),
        userService: new UserService(httpClient),
        errorReporter: createErrorReporterStub(),
      },
      queryClient,
    });

    // Then
    expect(await screen.findByText(RETRY_LABEL)).toBeTruthy();
  });

  test('한도 스냅샷을 읽지 못해도 오류를 던지지 않고 칸 안에서 다시 시도를 보인다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue(serverError());
    const queryClient = createQueryClient();
    queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'account-1', name: '아이도' });

    // When
    await renderUi(<SuggestionEntry />, {
      di: {
        entitlementService: new EntitlementService(httpClient, silentLogger),
        userService: new UserService(httpClient),
        errorReporter: createErrorReporterStub(),
      },
      queryClient,
    });

    // Then
    expect(await screen.findByText(RETRY_LABEL)).toBeTruthy();
  });
});
