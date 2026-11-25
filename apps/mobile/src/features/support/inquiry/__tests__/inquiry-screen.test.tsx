import '@src/shared/i18n/init';
import { INQUIRY_CATEGORY, INQUIRY_CONTENT_LIMITS } from '@aido/api/vocabulary';
import { fail, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import InquiryRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/inquiry';
import { createInquiryApiError, createInquiryResponseDto } from './inquiry.fixtures';

const CONTENT = '앱에서 할 일 추가 시 오류가 발생합니다.';
const OTHER_CONTENT = '알림이 정해 둔 시간보다 늦게 와요.';

async function renderInquiry(httpClient: ReturnType<typeof createHttpClientStub>) {
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  await renderScreen(<InquiryRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, haptics } }),
    withLocalDate: true,
    withOverlay: true,
  });

  return { analytics, haptics };
}

async function fillContent(content: string) {
  await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), content);
  await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeEnabled());
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

  it('10자보다 짧은 내용은 칸에 알리고 보내지 않는다', async () => {
    // Given
    await renderInquiry(httpClient);

    // When
    await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), '짧은 문의');
    await fireEvent.press(screen.getByTestId('inquiry-submit'));

    // Then
    expect(await screen.findByText('내용은 10자 이상 입력해주세요')).toBeOnTheScreen();
    expect(screen.getByTestId('inquiry-submit')).toBeDisabled();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('고른 분류로 접수하면 접수했다고 알리고 접수를 한 번 남긴다', async () => {
    // Given
    httpClient.post.mockResolvedValue(ok(createInquiryResponseDto()));
    const { analytics } = await renderInquiry(httpClient);
    await fireEvent.press(
      screen.getByTestId(`inquiry-category-${INQUIRY_CATEGORY.FEATURE_REQUEST}`),
    );
    await fillContent(CONTENT);

    // When
    await fireEvent.press(screen.getByTestId('inquiry-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledWith('v1/inquiries', {
      category: INQUIRY_CATEGORY.FEATURE_REQUEST,
      content: CONTENT,
    });
    expect(await screen.findAllByText('문의를 접수했어요')).not.toHaveLength(0);
    expect(
      analytics.trackEvent.mock.calls.filter(([name]) => name === 'support_inquiry_submitted'),
    ).toEqual([['support_inquiry_submitted', { category: INQUIRY_CATEGORY.FEATURE_REQUEST }]]);
  });

  it('서버가 거절하면 한 번 알리고 입력값을 지킨 채 화면에 머문다', async () => {
    // Given
    httpClient.post.mockResolvedValue(
      fail(createInquiryApiError({ code: 'SYS_0001', status: 400, message: '접수할 수 없어요' })),
    );
    const { haptics, analytics } = await renderInquiry(httpClient);
    await fillContent(CONTENT);

    // When
    await fireEvent.press(screen.getByTestId('inquiry-submit'));

    // Then
    expect(await screen.findAllByText('접수할 수 없어요')).not.toHaveLength(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(screen.getByTestId('inquiry-content-input').props.value).toBe(CONTENT);
    expect(router.back).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'support_inquiry_submitted',
      expect.anything(),
    );
  });

  it('보내는 동안 화면을 떠났으면 접수가 끝나도 또 뒤로 가지 않는다', async () => {
    // Given
    let isFocused = true;
    jest.mocked(useNavigation).mockImplementation(() => ({
      isFocused: () => isFocused,
      getParent: () => undefined,
      addListener: () => () => undefined,
    }));
    const pending = createPendingResponse(ok(createInquiryResponseDto()));
    httpClient.post.mockReturnValue(pending.response);
    await renderInquiry(httpClient);
    await fillContent(CONTENT);
    await fireEvent.press(screen.getByTestId('inquiry-submit'));

    // When
    isFocused = false;
    await act(async () => {
      pending.settle();
    });

    // Then
    expect(await screen.findAllByText('문의를 접수했어요')).not.toHaveLength(0);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('최대 길이를 넘긴 내용은 칸에 알리고 보내지 않는다', async () => {
    // Given
    await renderInquiry(httpClient);

    // When
    await fireEvent.changeText(
      screen.getByTestId('inquiry-content-input'),
      'a'.repeat(INQUIRY_CONTENT_LIMITS.MAX_LENGTH + 1),
    );
    await fireEvent.press(screen.getByTestId('inquiry-submit'));

    // Then
    expect(
      await screen.findByText(`내용은 ${INQUIRY_CONTENT_LIMITS.MAX_LENGTH}자 이내로 입력해주세요`),
    ).toBeOnTheScreen();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('같은 프레임에 두 번 눌러도 문의는 한 번만 보낸다', async () => {
    // Given
    const pending = createPendingResponse(ok(createInquiryResponseDto()));
    httpClient.post.mockReturnValue(pending.response);
    await renderInquiry(httpClient);
    await fillContent(CONTENT);
    const submit = screen.getByTestId('inquiry-submit');

    // When
    await act(async () => {
      await fireEvent.press(submit);
      await fireEvent.press(submit);
    });
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
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

    it('보내는 동안 떠났다가 접수된 뒤 돌아오면 새로 쓴 문의를 보낼 수 있다', async () => {
      // Given
      let isFocused = true;
      jest.mocked(useNavigation).mockImplementation(() => ({
        isFocused: () => isFocused,
        getParent: () => undefined,
        addListener: () => () => undefined,
      }));
      const pending = createPendingResponse(ok(createInquiryResponseDto()));
      httpClient.post
        .mockReturnValueOnce(pending.response)
        .mockResolvedValue(ok(createInquiryResponseDto()));
      await renderInquiry(httpClient);
      await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), CONTENT);
      await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('inquiry-submit'));
      isFocused = false;
      await act(async () => {
        pending.settle();
      });
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      isFocused = true;

      // When
      await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), OTHER_CONTENT);
      await act(() => jest.advanceTimersByTimeAsync(0));
      await fireEvent.press(screen.getByTestId('inquiry-submit'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(2);
    });

    function leaveWhileSending() {
      const navigation = { isFocused: true };
      jest.mocked(useNavigation).mockImplementation(() => ({
        isFocused: () => navigation.isFocused,
        getParent: () => undefined,
        addListener: () => () => undefined,
      }));
      jest
        .mocked(useLocalSearchParams)
        .mockReturnValue({ category: INQUIRY_CATEGORY.PAYMENT, content: CONTENT });
      const pending = createPendingResponse(ok(createInquiryResponseDto()));
      httpClient.post
        .mockReturnValueOnce(pending.response)
        .mockResolvedValue(ok(createInquiryResponseDto()));

      return {
        send: async () => {
          await renderInquiry(httpClient);
          await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeEnabled());
          await fireEvent.press(screen.getByTestId('inquiry-submit'));
          navigation.isFocused = false;
        },
        settleAndReturn: async () => {
          await act(async () => {
            pending.settle();
          });
          await act(() => jest.advanceTimersByTimeAsync(1_000));
          navigation.isFocused = true;
        },
      };
    }

    it('미리 채운 문의를 보내는 사이 떠났다가 접수된 뒤 돌아오면 내용이 비고 보내기가 꺼져 있다', async () => {
      // Given
      const { send, settleAndReturn } = leaveWhileSending();
      await send();

      // When
      await settleAndReturn();

      // Then
      expect(screen.getByTestId('inquiry-content-input')).toHaveDisplayValue('');
      await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeDisabled());
    });

    it('미리 채운 문의가 떠난 사이 접수된 뒤 새로 쓴 글은 고른 종류로 보낸다', async () => {
      // Given
      const { send, settleAndReturn } = leaveWhileSending();
      await send();
      await settleAndReturn();

      // When
      await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), OTHER_CONTENT);
      await act(() => jest.advanceTimersByTimeAsync(0));
      await fireEvent.press(screen.getByTestId('inquiry-submit'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenLastCalledWith('v1/inquiries', {
        category: INQUIRY_CATEGORY.PAYMENT,
        content: OTHER_CONTENT,
      });
    });
  });

  it('내용을 쳐도 폼을 가진 화면은 다시 그려지지 않고 칸과 버튼만 바뀐다', async () => {
    // Given
    await renderInquiry(httpClient);
    // 폼을 가진 화면만 navigation을 읽어, 그 호출 수가 화면이 그려진 횟수다
    const renderCountBeforeTyping = jest.mocked(useNavigation).mock.calls.length;

    // When
    await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), '앱');
    await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), CONTENT);
    await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), `${CONTENT} 다시`);
    await waitFor(() => expect(screen.getByTestId('inquiry-submit')).toBeEnabled());

    // Then
    expect(jest.mocked(useNavigation).mock.calls).toHaveLength(renderCountBeforeTyping);
  });
});
