import '@src/shared/i18n/init';
import { zodResolver } from '@hookform/resolvers/zod';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';

import { createTodoComment, TODO_ID } from '../__tests__/todo-comment.fixtures';
import { TodoCommentFormProvider } from '../hooks/use-todo-comment-form';
import { todoCommentFormSchema, toEditFormValues } from '../schemas/todo-comment-form.schema';
import { TodoCommentExpansionProvider } from './todo-comment-expansion';
import { TodoCommentForm } from './todo-comment-form';
import { TodoCommentRevealProvider } from './todo-comment-reveal';

/** 폼 스키마가 계약을 그대로 검사하므로 서버가 보낼 수 있는 id를 쓴다 */
const TARGET = createTodoComment({
  id: 'ckcomment0001',
  content: '원래 글',
  author: {
    id: 'ckauthor00001',
    name: '나',
    userTag: 'WNTQJEEE',
    profileImage: null,
    isTodoOwner: true,
  },
});

function EditingForm() {
  const form = useForm({
    resolver: zodResolver(todoCommentFormSchema),
    defaultValues: toEditFormValues(TARGET),
    mode: 'onChange',
  });

  return (
    <TodoCommentFormProvider form={form}>
      <TodoCommentRevealProvider>
        <TodoCommentExpansionProvider>
          <TodoCommentForm />
        </TodoCommentExpansionProvider>
      </TodoCommentRevealProvider>
    </TodoCommentFormProvider>
  );
}

async function renderEditingForm() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ok(createCurrentUserDto()));
  jest.mocked(useLocalSearchParams).mockReturnValue({ todoId: String(TODO_ID) });
  await renderScreen(<EditingForm />, {
    di: createTestDi({ ports: { httpClient } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await screen.findByTestId('todo-comment-composer-target');

  return httpClient;
}

describe('댓글 수정', () => {
  it('글자를 바꾸지 않고 저장하면 요청 없이 작성기를 닫는다', async () => {
    // Given
    const httpClient = await renderEditingForm();

    // When
    await fireEvent.press(screen.getByTestId('todo-comment-submit'));

    // Then
    await waitFor(() => expect(screen.queryByTestId('todo-comment-composer-target')).toBeNull());
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('앞뒤 공백만 더한 글도 바뀐 것이 아니다', async () => {
    // Given
    const httpClient = await renderEditingForm();

    // When
    await fireEvent.changeText(screen.getByTestId('todo-comment-input-0'), '  원래 글  ');
    await fireEvent.press(screen.getByTestId('todo-comment-submit'));

    // Then
    await waitFor(() => expect(screen.queryByTestId('todo-comment-composer-target')).toBeNull());
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
});
