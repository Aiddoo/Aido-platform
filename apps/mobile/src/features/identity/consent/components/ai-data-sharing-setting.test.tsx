import '@src/shared/i18n/init';
import { AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import { toInstant } from '@src/shared/date/instant';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi, createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { createConsent } from '../__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '../queries/consent-query-keys';
import { AiDataSharingSetting } from './ai-data-sharing-setting';

describe('AiDataSharingSetting', () => {
  it('동의 철회가 실패하면 토글을 되돌리고 확인 다이얼로그를 남겨 다시 누르거나 취소할 수 있다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const withdrawal = Promise.withResolvers<Result<unknown, ApiError>>();
    httpClient.patch.mockReturnValue(withdrawal.promise);
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(
      CONSENT_QUERY_KEYS.detail(),
      createConsent({
        aiDataSharingDecision: AI_DATA_SHARING_DECISION.AGREED,
        aiDataSharingAgreedAt: toInstant('2026-03-01T00:00:00.000Z'),
        aiDataSharingConsentVersion: '1.0.0',
      }),
    );
    await renderScreen(<AiDataSharingSetting />, {
      withLocalDate: true,
      withOverlay: true,
      di: createTestDi({ ports: { httpClient, queryClient } }),
    });
    // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않는다
    const opening = fireEvent(
      screen.getByTestId('ai-data-sharing-toggle'),
      'selectedChange',
      false,
    );
    await screen.findByText('동의를 철회할까요?');

    // When
    // 확인 누름은 요청이 끝나야 풀린다. 그리기만 마치고 약속은 쥔다
    let confirmPress: Promise<void> = Promise.resolve();
    await act(async () => {
      confirmPress = fireEvent.press(screen.getByTestId('ai-data-sharing-withdraw-confirm'));
    });

    // Then
    expect(screen.getByText('동의를 철회할까요?')).toBeOnTheScreen();

    // When
    await act(async () => {
      withdrawal.reject(new NetworkError());
      await confirmPress;
    });

    // Then
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('동의를 철회할까요?')).toBeOnTheScreen();
    expect(screen.getByTestId('ai-data-sharing-withdraw-confirm')).toBeEnabled();
    expect(queryClient.getQueryData(CONSENT_QUERY_KEYS.detail())).toMatchObject({
      aiDataSharingDecision: AI_DATA_SHARING_DECISION.AGREED,
    });
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await opening;
  });
});
