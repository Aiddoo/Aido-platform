import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AddSubTodoBottomSheet } from './AddSubTodoBottomSheet';

function createDeferred() {
  let settle: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });

  return { promise, settle: () => settle() };
}

const submitButton = () => screen.getByTestId('sub-todo-submit');
const deleteButton = () => screen.getByTestId('sub-todo-delete');

/**
 * 진행 중 플래그를 밖에서 받던 시절, 이 시트는 오버레이로만 열려서 그 값이 열릴 때의
 * false에 얼어붙었다. 수정 모드는 보낸 뒤에도 입력을 비우지 않으므로 버튼이 계속 열려 있어
 * 연타하면 같은 PATCH가 여러 번 나갔다.
 */
describe('AddSubTodoBottomSheet 수정 모드', () => {
  it('보내는 동안 전송과 삭제가 모두 잠긴다', async () => {
    const deferred = createDeferred();
    await renderUi(
      <AddSubTodoBottomSheet
        mode="edit"
        initialValue="장 보기"
        isOpen
        onOpenChange={jest.fn()}
        onClose={jest.fn()}
        onSubmit={() => deferred.promise}
        onDelete={jest.fn()}
      />,
    );

    // 끝나지 않은 채로 둔다 — 그 사이의 잠금이 이 테스트의 대상이다.
    const pressing = fireEvent.press(submitButton());

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    expect(deleteButton()).toBeDisabled();

    deferred.settle();
    await pressing;

    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });
  });

  it('지우는 동안에도 전송이 함께 잠긴다', async () => {
    const deferred = createDeferred();
    await renderUi(
      <AddSubTodoBottomSheet
        mode="edit"
        initialValue="장 보기"
        isOpen
        onOpenChange={jest.fn()}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        onDelete={() => deferred.promise}
      />,
    );

    const pressing = fireEvent.press(deleteButton());

    await waitFor(() => {
      expect(deleteButton()).toBeDisabled();
    });
    expect(submitButton()).toBeDisabled();

    deferred.settle();
    await pressing;
  });

  it('보낸 뒤에도 수정 모드는 쓰던 값을 지우지 않는다', async () => {
    const onSubmit = jest.fn();
    await renderUi(
      <AddSubTodoBottomSheet
        mode="edit"
        initialValue="장 보기"
        isOpen
        onOpenChange={jest.fn()}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        onDelete={jest.fn()}
      />,
    );

    await fireEvent.press(submitButton());

    expect(onSubmit).toHaveBeenCalledWith('장 보기');
    expect(screen.getByTestId('sub-todo-input')).toHaveProp('value', '장 보기');
  });
});
