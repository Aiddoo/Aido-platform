import { Text } from '@src/shared/ui';
import { getLastGorhomSheetProps } from '@src/testing/mocks/gorhom-bottom-sheet';
import { renderScreen } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import { ModalBottomSheet } from './modal-bottom-sheet';

describe('ModalBottomSheet', () => {
  it('닫기가 시작되는 순간 값을 돌려주고 아래 시트가 키보드를 함께 올릴 수 있게 알린다', async () => {
    // Given
    const onOpenChange = jest.fn();
    const onCloseStart = jest.fn();
    await renderScreen(
      <ModalBottomSheet
        isOpen
        onOpenChange={onOpenChange}
        onCloseStart={onCloseStart}
        onExit={jest.fn()}
      >
        <Text>내용</Text>
      </ModalBottomSheet>,
    );
    expect(onCloseStart).not.toHaveBeenCalled();

    // When
    await act(async () => getLastGorhomSheetProps().onAnimate(0, -1));

    // Then
    expect(onCloseStart).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('닫기 애니메이션이 끝나기 전에는 내용을 지우지 않는다', async () => {
    // Given
    const onExit = jest.fn();

    // When
    await renderScreen(
      <ModalBottomSheet isOpen onOpenChange={jest.fn()} onExit={onExit}>
        <Text>내용</Text>
      </ModalBottomSheet>,
    );

    // Then
    expect(onExit).not.toHaveBeenCalled();
  });
});
