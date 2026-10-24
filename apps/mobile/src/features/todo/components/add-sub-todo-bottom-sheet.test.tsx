import '@src/shared/i18n/init';
import { createMockAnalytics, createMockHttpClient } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createParentTodo, createSubTodo } from '../__tests__/sub-todo.factories';
import { SubTodoService } from '../apis/sub-todo.service';
import { AddSubTodoBottomSheet } from './add-sub-todo-bottom-sheet';

const submitButton = () => screen.getByTestId('sub-todo-submit');
const deleteButton = () => screen.getByTestId('sub-todo-delete');

async function renderEditSheet() {
  const httpClient = createMockHttpClient();
  httpClient.patch.mockReturnValue(new Promise(() => undefined));
  httpClient.delete.mockReturnValue(new Promise(() => undefined));

  await renderUi(
    <AddSubTodoBottomSheet
      mode="edit"
      todo={createParentTodo()}
      subTodo={createSubTodo({ title: '장 보기' })}
      isOpen
      onOpenChange={jest.fn()}
      onClose={jest.fn()}
    />,
    {
      di: { subTodoService: new SubTodoService(httpClient), analytics: createMockAnalytics() },
    },
  );

  return { httpClient };
}

describe('AddSubTodoBottomSheet 수정 모드', () => {
  it('보내는 동안 전송과 삭제가 모두 잠긴다', async () => {
    const { httpClient } = await renderEditSheet();

    fireEvent.press(submitButton()).catch(() => undefined);

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    expect(deleteButton()).toBeDisabled();
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('지우는 동안에도 전송이 함께 잠긴다', async () => {
    const { httpClient } = await renderEditSheet();

    fireEvent.press(deleteButton()).catch(() => undefined);

    await waitFor(() => {
      expect(deleteButton()).toBeDisabled();
    });
    expect(submitButton()).toBeDisabled();
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });
});
