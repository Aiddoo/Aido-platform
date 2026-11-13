import '@src/shared/i18n/init';
import { INQUIRY_CATEGORY } from '@aido/api';
import { ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import { createHapticsGatewayStub, createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import InquiryRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/inquiry';
import { createInquiryResponseDto } from './inquiry.fixtures';

const CONTENT = '앱에서 할 일 추가 시 오류가 발생합니다.';

async function renderInquiry(httpClient: ReturnType<typeof createHttpClientStub>) {
  await renderScreen(<InquiryRoute />, {
    di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
    withLocalDate: true,
    withOverlay: true,
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

  describe('접수 뒤 떠나는 동안', () => {
    setupFakeTimersPerTest();

    it('접수해 화면이 내려가는 동안 다시 눌러도 문의는 한 번만 보낸다', async () => {
      // Given
      httpClient.post.mockResolvedValue(ok(createInquiryResponseDto()));
      await renderInquiry(httpClient);
      await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), CONTENT);
      await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('inquiry-submit'));
      // 연타 가드(600ms)가 지난 뒤다. 화면은 뒤로 가는 전환이 끝나야 내려가 버튼이 아직 보인다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(router.back).toHaveBeenCalledTimes(1);

      // When
      await fireEvent.press(screen.getByTestId('inquiry-submit'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });
  });
});
