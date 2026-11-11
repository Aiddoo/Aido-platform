import '@src/shared/i18n/init';
import { INQUIRY_CATEGORY } from '@aido/api';
import { ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import { createHapticsGatewayStub, createHttpClientStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import InquiryRoute from '../../../../../app/(app)/(tabs)/(mypage)/settings/inquiry';
import { createInquiryResponseDto } from './inquiry.fixtures';

const CONTENT = '앱에서 할 일 추가 시 오류가 발생합니다.';

async function renderInquiry(httpClient: ReturnType<typeof createHttpClientStub>) {
  await renderScreen(<InquiryRoute />, {
    withLocalDate: true,
    withOverlay: true,
    di: { httpClient, haptics: createHapticsGatewayStub() },
  });
}

describe('문의 화면', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    jest.mocked(router.back).mockClear();
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    httpClient = createHttpClientStub();
  });

  it('공백만 채운 내용은 보낼 수 없다', async () => {
    // Given
    await renderInquiry(httpClient);

    // When
    await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), ' '.repeat(30));

    // Then
    await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeDisabled());
  });

  it('다른 화면이 넘긴 분류와 내용으로 미리 채운다', async () => {
    // Given
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ category: INQUIRY_CATEGORY.PAYMENT, content: CONTENT });

    // When
    await renderInquiry(httpClient);

    // Then
    expect(screen.getByTestId('inquiry-content-input').props.value).toBe(CONTENT);
    await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeEnabled());
  });

  it('연결이 끊겨 실패해도 입력값을 지키고 화면에 머문다', async () => {
    // Given
    httpClient.post.mockRejectedValue(new NetworkError());
    await renderInquiry(httpClient);
    await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), CONTENT);
    await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('inquiry-submit'));

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(screen.getByTestId('inquiry-content-input').props.value).toBe(CONTENT);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('접수하면 앞뒤 공백을 뺀 내용을 한 번만 보내고 뒤로 간다', async () => {
    // Given
    httpClient.post.mockResolvedValue(ok(createInquiryResponseDto()));
    await renderInquiry(httpClient);
    await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), `  ${CONTENT}\n`);
    await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('inquiry-submit'));
    await fireEvent.press(screen.getByTestId('inquiry-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith('v1/inquiries', {
      category: INQUIRY_CATEGORY.BUG_REPORT,
      content: CONTENT,
    });
  });
});
