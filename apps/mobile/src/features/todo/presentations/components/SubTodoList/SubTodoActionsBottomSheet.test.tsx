import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { SubTodoActionsBottomSheet } from './SubTodoActionsBottomSheet';

function renderSheet(onDelete: () => Promise<unknown> | void) {
  return renderUi(
    <SubTodoActionsBottomSheet
      isOpen
      onOpenChange={jest.fn()}
      onClose={jest.fn()}
      onEdit={jest.fn()}
      onDelete={onDelete}
    />,
  );
}

describe('SubTodoActionsBottomSheet', () => {
  it('지우는 동안 라벨이 바뀌고 다시 눌리지 않는다', async () => {
    let settle: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const onDelete = jest.fn(() => pending);
    await renderSheet(onDelete);

    // 끝나지 않은 채로 둔다 — 그 사이의 표시와 잠금이 이 테스트의 대상이다.
    const pressing = fireEvent.press(screen.getByText('삭제하기'));

    await waitFor(() => {
      expect(screen.getByText('삭제 중...')).toBeOnTheScreen();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);

    settle();
    await pressing;
  });
});
