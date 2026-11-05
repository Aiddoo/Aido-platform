import { getLastGorhomSheetProps } from '@src/shared/__tests__/mocks/gorhom-bottom-sheet';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { Text } from '@src/shared/ui';
import { act } from '@testing-library/react-native';

import { BottomSheet } from './bottom-sheet';
import { KeyboardBottomSheet } from './keyboard-bottom-sheet';

describe.each([
  ['BottomSheet', BottomSheet],
  ['KeyboardBottomSheet', KeyboardBottomSheet],
])('%s 닫힘 알림', (_name, Sheet) => {
  it('열리는 도중에 닫혀 gorhom이 onClose만 불러도 닫혔다고 알려 route가 투명하게 남지 않는다', async () => {
    // Given
    const onOpenChange = jest.fn();
    await renderUi(
      <Sheet isOpen onOpenChange={onOpenChange}>
        <Text>내용</Text>
      </Sheet>,
    );

    // When
    await act(async () => getLastGorhomSheetProps().onClose());

    // Then
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('다 열린 뒤 닫혀 onChange와 onClose가 함께 와도 한 번만 알린다', async () => {
    // Given
    const onOpenChange = jest.fn();
    await renderUi(
      <Sheet isOpen onOpenChange={onOpenChange}>
        <Text>내용</Text>
      </Sheet>,
    );
    await act(async () => getLastGorhomSheetProps().onChange(0));

    // When
    await act(async () => {
      getLastGorhomSheetProps().onChange(-1);
      getLastGorhomSheetProps().onClose();
    });

    // Then
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });
});
