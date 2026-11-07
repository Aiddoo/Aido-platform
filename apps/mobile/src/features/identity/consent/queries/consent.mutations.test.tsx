import '@src/shared/i18n/init';
import { createHttpClientStub } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { NetworkError } from '@src/shared/errors/infra-error';
import { useMutation } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';

import { createConsent } from '../__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '../constants/consent-query-keys';
import type { Consent } from '../schemas/consent.schema';
import {
  useUpdateMarketingConsentMutationOptions,
  useUpdateMarketingPushConsentMutationOptions,
} from './consent.mutations';

async function renderMarketing(httpClient = createHttpClientStub()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.consent(),
    createConsent({ marketingAgreedAt: null, marketingPushAgreedAt: null }),
  );
  let marketing: ReturnType<typeof useMarketing> | undefined;
  let marketingPush: ReturnType<typeof useMarketingPush> | undefined;
  function useMarketing() {
    return useMutation(useUpdateMarketingConsentMutationOptions());
  }
  function useMarketingPush() {
    return useMutation(useUpdateMarketingPushConsentMutationOptions());
  }
  function Capture() {
    marketing = useMarketing();
    marketingPush = useMarketingPush();
    return null;
  }
  await renderUi(<Capture />, { queryClient, di: { httpClient } });

  return {
    cached: () => queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.consent()),
    updateMarketing: () => marketing?.mutateAsync({ agreed: true }),
    updateMarketingPush: () => marketingPush?.mutateAsync({ agreed: true }),
  };
}

describe('마케팅 수신 동의 토글', () => {
  it('연결이 없으면 멈추지 않고 바로 실패해 토글을 되돌리고 알린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.patch.mockRejectedValue(new NetworkError());
    const { cached, updateMarketing } = await renderMarketing(httpClient);

    // When
    const result = updateMarketing();

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(cached()?.marketingAgreedAt).toBeNull();
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
  });

  it('광고성 푸시 동의도 실패하면 되돌리고 알린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.patch.mockRejectedValue(new NetworkError());
    const { cached, updateMarketingPush } = await renderMarketing(httpClient);

    // When
    const result = updateMarketingPush();

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(cached()?.marketingPushAgreedAt).toBeNull();
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
  });
});
