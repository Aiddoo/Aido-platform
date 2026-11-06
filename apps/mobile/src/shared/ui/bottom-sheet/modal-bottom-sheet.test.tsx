import { getLastGorhomSheetProps } from '@src/shared/__tests__/mocks/gorhom-bottom-sheet';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { Text } from '@src/shared/ui';
import { act, screen, within } from '@testing-library/react-native';

import { ModalBottomSheet } from './modal-bottom-sheet';
import { SheetHeaderLayout } from './sheet-header-layout';

describe('ModalBottomSheet', () => {
  it('닫기가 시작되는 순간 값을 돌려주고 아래 시트가 키보드를 함께 올릴 수 있게 알린다', async () => {
    // Given
    const onOpenChange = jest.fn();
    const onCloseStart = jest.fn();
    await renderUi(
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
    await renderUi(
      <ModalBottomSheet isOpen onOpenChange={jest.fn()} onExit={onExit}>
        <Text>내용</Text>
      </ModalBottomSheet>,
    );

    // Then
    expect(onExit).not.toHaveBeenCalled();
  });

  describe('내용이 넘칠 때', () => {
    const sheet = (
      <ModalBottomSheet hasFixedHeader isOpen onOpenChange={jest.fn()} onExit={jest.fn()}>
        <SheetHeaderLayout gap={20} header={<Text testID="header">머리글</Text>}>
          <Text testID="body">본문</Text>
        </SheetHeaderLayout>
      </ModalBottomSheet>
    );

    it('머리글은 스크롤 영역 밖에 두고 본문만 스크롤한다', async () => {
      // When
      await renderUi(sheet);

      // Then
      const scroll = screen.getByTestId('sheet-scroll-area');
      expect(within(scroll).getByTestId('body')).toBeTruthy();
      expect(within(scroll).queryByTestId('header')).toBeNull();
      expect(screen.getByTestId('header')).toBeTruthy();
    });

    it('아래 줄을 주면 머리글처럼 스크롤 영역 밖에 남는다', async () => {
      // When
      await renderUi(
        <ModalBottomSheet hasFixedHeader isOpen onOpenChange={jest.fn()} onExit={jest.fn()}>
          <SheetHeaderLayout
            gap={20}
            header={<Text>머리글</Text>}
            footer={<Text testID="footer" />}
          >
            <Text testID="body">본문</Text>
          </SheetHeaderLayout>
        </ModalBottomSheet>,
      );

      // Then
      const scroll = screen.getByTestId('sheet-scroll-area');
      expect(within(scroll).queryByTestId('footer')).toBeNull();
      expect(screen.getByTestId('footer')).toBeTruthy();
    });
  });
});
