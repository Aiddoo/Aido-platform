import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createHttpClientStub, createTestDi, createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import {
  createSuggestionAnalysisDto,
  createSuggestionListDto,
} from '../__tests__/suggestion.fixtures';
import { SuggestionStatus } from './suggestion-status';

describe('SuggestionStatus', () => {
  it('앱은 동의했다고 알지만 받은 상태가 동의 전이면 받는 중 틀에 머물지 않고 동의 안내를 보인다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(
      ok(
        createSuggestionListDto({
          suggestions: [],
          analysis: createSuggestionAnalysisDto({ state: 'NEEDS_AI_CONSENT' }),
        }),
      ),
    );
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
    queryClient.setQueryData(
      CONSENT_QUERY_KEYS.detail(),
      createConsent({ aiDataSharingDecision: 'AGREED' }),
    );

    // When
    await renderScreen(
      <Suspense fallback={null}>
        <SuggestionStatus />
      </Suspense>,
      {
        di: createTestDi({ ports: { httpClient, queryClient } }),
        withLocalDate: true,
        withOverlay: true,
      },
    );

    // Then
    expect(await screen.findByText('AI 제안을 받으려면 동의가 필요해요')).toBeTruthy();
  });
});
