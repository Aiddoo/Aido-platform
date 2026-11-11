import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors/infra-error';
import { useMutation } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';

import { createConsent, createUpdateMarketingConsentDto } from '../__tests__/consent.fixtures';
import { type Consent } from '../domains/consent.model';
import { CONSENT_QUERY_KEYS } from './consent-query-keys';
import {
  useUpdateMarketingConsentMutationOptions,
  useUpdateMarketingPushConsentMutationOptions,
} from './consent.mutations';

async function renderMarketing(httpClient = createHttpClientStub()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.detail(),
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
  await renderUi(<Capture />, { queryClient, di: { httpClient }, withLocalDate: true });

  return {
    cached: () => queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.detail()),
    updateMarketing: (agreed = true) => marketing?.mutateAsync({ agreed }),
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

describe('마케팅 수신 동의 결과 알림', () => {
  it('동의하면 서버가 기록한 날짜로 전송자와 결과를 알린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.patch.mockResolvedValue(
      ok(createUpdateMarketingConsentDto({ marketingAgreedAt: '2026-03-01T12:00:00.000Z' })),
    );
    const { updateMarketing } = await renderMarketing(httpClient);

    // When
    await act(async () => {
      await updateMarketing(true);
    });

    // Then
    expect(
      await screen.findAllByText('2026년 3월 1일 아이두 마케팅 정보 수신에 동의했어요'),
    ).not.toHaveLength(0);
  });
  it('철회하면 서버가 처리한 날짜로 결과를 알린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.patch.mockResolvedValue(
      ok(
        createUpdateMarketingConsentDto({
          marketingAgreedAt: null,
          marketingWithdrawnAt: '2026-03-02T12:00:00.000Z',
        }),
      ),
    );
    const { updateMarketing } = await renderMarketing(httpClient);

    // When
    await act(async () => {
      await updateMarketing(false);
    });

    // Then
    expect(
      await screen.findAllByText('2026년 3월 2일 아이두 마케팅 정보 수신 동의를 철회했어요'),
    ).not.toHaveLength(0);
  });
});

describe('마케팅 수신 동의를 연달아 바꿈', () => {
  it('켜기 응답이 끄기보다 먼저 와도 마지막에 고른 꺼짐을 지킨다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const turnOn = createPendingResponse(
      ok(createUpdateMarketingConsentDto({ marketingAgreedAt: '2026-03-01T00:00:00.000Z' })),
    );
    const turnOff = createPendingResponse(
      ok(createUpdateMarketingConsentDto({ marketingAgreedAt: null })),
    );
    httpClient.patch
      .mockImplementationOnce(() => turnOn.response)
      .mockImplementationOnce(() => turnOff.response);
    const { cached, updateMarketing } = await renderMarketing(httpClient);
    const turnOnResult = updateMarketing(true);
    const turnOffResult = updateMarketing(false);
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(2));

    // When
    await act(async () => {
      turnOn.settle();
      await turnOnResult;
    });

    // Then
    expect(cached()?.marketingAgreedAt).toBeNull();
    await act(async () => {
      turnOff.settle();
      await turnOffResult;
    });
    expect(cached()?.marketingAgreedAt).toBeNull();
  });
});
