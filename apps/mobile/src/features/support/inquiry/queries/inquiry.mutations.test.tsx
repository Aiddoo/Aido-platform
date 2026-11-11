import { INQUIRY_CATEGORY } from '@aido/api';
import { ApiError } from '@src/core/errors/api-error';
import { ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import { createHapticsGatewayStub, createHttpClientStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { onlineManager, useMutation } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createInquiryApiError, createInquiryResponseDto } from '../__tests__/inquiry.fixtures';
import { useCreateInquiryMutationOptions } from './inquiry.mutations';

const input = {
  category: INQUIRY_CATEGORY.BUG_REPORT,
  content: '앱에서 할 일 추가 시 오류가 발생합니다.',
} as const;

async function renderSubmit(httpClient: ReturnType<typeof createHttpClientStub>) {
  let submit: ((values: typeof input) => Promise<unknown>) | undefined;
  function Capture() {
    submit = useMutation(useCreateInquiryMutationOptions()).mutateAsync;
    return null;
  }
  await renderScreen(<Capture />, {
    withOverlay: true,
    di: { httpClient, haptics: createHapticsGatewayStub() },
  });
  if (submit == null) {
    throw new Error('mutation을 받지 못했다');
  }

  return submit;
}

describe('문의 접수', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    jest.mocked(router.back).mockClear();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('접수하면 안내하고 화면 이동은 화면에 맡긴다', async () => {
    // Given
    httpClient.post.mockResolvedValue(ok(createInquiryResponseDto()));
    const submit = await renderSubmit(httpClient);

    // When
    await submit(input);

    // Then
    expect(httpClient.post).toHaveBeenCalledWith('v1/inquiries', input);
    expect(await screen.findAllByText('문의를 접수했어요.')).not.toHaveLength(0);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('오프라인이어도 멈춰 기다리지 않고 바로 실패를 알리며 화면을 떠나지 않는다', async () => {
    // Given
    onlineManager.setOnline(false);
    httpClient.post.mockRejectedValue(new NetworkError());
    const submit = await renderSubmit(httpClient);

    // When
    const result = submit(input);

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('서버가 거절한 문의는 토스트로 이유를 알린다', async () => {
    // Given
    const apiError = createInquiryApiError({ status: 400, message: '내용이 너무 짧아요' });
    httpClient.post.mockResolvedValue({ ok: false, error: apiError });
    const submit = await renderSubmit(httpClient);

    // When
    const result = submit(input);

    // Then
    await expect(result).rejects.toBeInstanceOf(ApiError);
    expect(await screen.findAllByText('내용이 너무 짧아요')).not.toHaveLength(0);
  });
});
