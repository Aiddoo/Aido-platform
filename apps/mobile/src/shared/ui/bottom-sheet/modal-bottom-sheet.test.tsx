import { renderUi } from '@src/shared/__tests__/render-ui';
import { Text } from '@src/shared/ui';

import { ModalBottomSheet } from './modal-bottom-sheet';

describe('ModalBottomSheet', () => {
  it('닫기가 시작되는 순간 한 번 알려 아래 시트가 키보드를 함께 올릴 수 있다', async () => {
    // Given
    const onCloseStart = jest.fn();
    const sheet = (isOpen: boolean) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onOpenChange={jest.fn()}
        onCloseStart={onCloseStart}
        onExit={jest.fn()}
      >
        <Text>내용</Text>
      </ModalBottomSheet>
    );
    const { rerender } = await renderUi(sheet(true));
    expect(onCloseStart).not.toHaveBeenCalled();

    // When
    await rerender(sheet(false));
    await rerender(sheet(false));

    // Then
    expect(onCloseStart).toHaveBeenCalledTimes(1);
  });
});
