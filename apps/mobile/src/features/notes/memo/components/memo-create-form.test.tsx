import { ok } from '@src/core/errors/result';
import '@src/shared/i18n/init';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { TimeoutError } from '@src/shared/errors/infra-error';
import { createHttpClientStub, createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Suspense } from 'react';

import { MemoCreateForm } from './memo-create-form';

const CREATED_MEMO_DTO = {
  id: 9,
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  content: '새 메모',
  isPinned: false,
  sortOrder: 0,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
};

async function renderForm() {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
  const httpClient = createHttpClientStub();
  await renderScreen(
    <Suspense fallback={null}>
      <MemoCreateForm />
    </Suspense>,
    { queryClient, withLocalDate: true, di: { httpClient } },
  );

  return { httpClient };
}

async function typeContent(content: string) {
  const input = await screen.findByPlaceholderText('아이디어를 자유롭게 적어보세요...');
  await act(async () => {
    fireEvent.changeText(input, content);
  });
}

describe('MemoCreateForm', () => {
  it('저장 버튼을 빠르게 두 번 눌러도 메모는 한 번만 만든다', async () => {
    // Given
    const { httpClient } = await renderForm();
    httpClient.post.mockResolvedValue(ok({ message: 'created', memo: CREATED_MEMO_DTO }));
    await typeContent('새 메모');
    const save = await screen.findByLabelText('저장');

    // When
    await act(async () => {
      fireEvent.press(save);
      fireEvent.press(save);
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('공백만 넣으면 저장 버튼이 꺼진다', async () => {
    // Given
    await renderForm();

    // When
    await typeContent('   ');

    // Then
    expect((await screen.findByLabelText('저장')).props.accessibilityState.disabled).toBe(true);
  });
});

describe('MemoCreateForm 시간 초과 뒤 다시 저장', () => {
  setupFakeTimersPerTest();

  async function saveAfterTimeout(httpClient: ReturnType<typeof createHttpClientStub>) {
    httpClient.post
      .mockRejectedValueOnce(new TimeoutError())
      .mockResolvedValueOnce(ok({ message: 'created', memo: CREATED_MEMO_DTO }));
    await typeContent('새 메모');
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('저장'));
    });
    await screen.findAllByText('응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요');
    // 연타 가드(600ms)가 지난 뒤의 두 번째 저장이다
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }

  it('같은 글을 다시 저장하면 같은 키를 보내 서버가 메모를 하나만 만든다', async () => {
    // Given
    const { httpClient } = await renderForm();
    await saveAfterTimeout(httpClient);

    // When
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('저장'));
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const [first, retried] = httpClient.post.mock.calls;
    expect(first?.[2]).toEqual({ headers: { 'Idempotency-Key': expect.any(String) } });
    expect(retried?.[2]).toEqual(first?.[2]);
  });

  it('글을 고쳐 저장하면 새 키를 보내 고친 글이 새 메모로 남는다', async () => {
    // Given
    const { httpClient } = await renderForm();
    await saveAfterTimeout(httpClient);

    // When
    await typeContent('새 메모 고침');
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('저장'));
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const [first, edited] = httpClient.post.mock.calls;
    expect(edited?.[2]).not.toEqual(first?.[2]);
  });
});
