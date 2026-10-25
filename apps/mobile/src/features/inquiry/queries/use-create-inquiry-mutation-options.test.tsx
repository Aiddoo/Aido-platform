import { INQUIRY_CATEGORY } from '@aido/api';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createMockDIContainer, createMockHttpClient } from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createInquiryApiError } from '../__tests__/inquiry.factories';
import { InquiryService } from '../apis/inquiry.service';
import { useCreateInquiryMutationOptions } from './use-create-inquiry-mutation-options';

const mockToastError = jest.fn();

jest.mock('@src/shared/hooks/use-app-toast', () => ({
  useAppToast: () => ({ success: jest.fn(), error: mockToastError }),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const input = {
  category: INQUIRY_CATEGORY.BUG_REPORT,
  content: '앱에서 할 일 추가 시 오류가 발생합니다.',
} as const;

describe('문의 접수 실패 안내', () => {
  let client: QueryClient;
  let http: ReturnType<typeof createMockHttpClient>;
  let unmount: (() => Promise<void>) | undefined;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
    });
    http = createMockHttpClient();
    unmount = undefined;
  });

  afterEach(async () => {
    await unmount?.();
    client.clear();
  });

  const submitInquiry = async () => {
    const container = createMockDIContainer({ inquiryService: new InquiryService(http) });
    const rendered = await renderHook(() => useCreateInquiryMutationOptions(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <StaticDIProvider container={container}>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </StaticDIProvider>
      ),
    });
    unmount = rendered.unmount;
    const mutation = client.getMutationCache().build(client, rendered.result.current);
    await act(async () => {
      await mutation.execute(input).catch(() => undefined);
    });
  };

  it('서버가 거절한 문의는 toast로 이유를 알린다', async () => {
    // Given
    const apiError = createInquiryApiError({ status: 400 });
    http.post.mockResolvedValue({ ok: false, error: apiError });

    // When
    await submitInquiry();

    // Then
    expect(mockToastError).toHaveBeenCalledWith(apiError, expect.anything());
  });

  it('네트워크 오류는 화면 오류 경계에 맡기고 toast를 띄우지 않는다', async () => {
    // Given
    http.post.mockRejectedValue(new NetworkError());

    // When
    await submitInquiry();

    // Then
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
