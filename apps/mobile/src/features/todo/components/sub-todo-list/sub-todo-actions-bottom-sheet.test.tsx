import '@src/shared/i18n/init';
import { createMockAnalytics, createMockHttpClient } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createParentTodo, createSubTodo } from '../../__tests__/sub-todo.factories';
import { SubTodoService } from '../../apis/sub-todo.service';
import { SubTodoActionsBottomSheet } from './sub-todo-actions-bottom-sheet';

describe('SubTodoActionsBottomSheet', () => {
  it('지우는 동안 라벨이 바뀌고 다시 눌리지 않는다', async () => {
    const httpClient = createMockHttpClient();
    httpClient.delete.mockReturnValue(new Promise(() => undefined));
    await renderUi(
      <SubTodoActionsBottomSheet
        todo={createParentTodo()}
        subTodo={createSubTodo()}
        isOpen
        onOpenChange={jest.fn()}
        onClose={jest.fn()}
        onEdit={jest.fn()}
      />,
      {
        di: { subTodoService: new SubTodoService(httpClient), analytics: createMockAnalytics() },
      },
    );

    fireEvent.press(screen.getByText('삭제하기')).catch(() => undefined);

    await waitFor(() => {
      expect(screen.getByText('삭제 중...')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByText('삭제 중...')).catch(() => undefined);
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });
});
