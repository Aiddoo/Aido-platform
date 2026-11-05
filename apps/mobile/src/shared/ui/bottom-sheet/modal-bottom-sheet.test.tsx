import { renderUi } from '@src/shared/__tests__/render-ui';
import { Text } from '@src/shared/ui';
import { fireEvent, screen, within } from '@testing-library/react-native';

import { ModalBottomSheet } from './modal-bottom-sheet';
import { SheetHeaderLayout } from './sheet-header-layout';

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

  describe('내용이 넘칠 때', () => {
    const sheet = (
      <ModalBottomSheet hasFixedHeader isOpen onOpenChange={jest.fn()} onExit={jest.fn()}>
        <SheetHeaderLayout gap={20} header={<Text testID="header">머리글</Text>}>
          <Text testID="body">본문</Text>
        </SheetHeaderLayout>
      </ModalBottomSheet>
    );

    async function fitContent(viewportHeight: number, contentHeight: number) {
      const scroll = screen.getByTestId('sheet-scroll-area');
      await fireEvent(scroll, 'layout', { nativeEvent: { layout: { height: viewportHeight } } });
      await fireEvent(scroll, 'contentSizeChange', 300, contentHeight);
      return scroll;
    }

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

    it('넘치지 않으면 흐림과 스크롤 막대가 없어 평소 모양 그대로다', async () => {
      // Given
      await renderUi(sheet);

      // When
      const scroll = await fitContent(400, 400);

      // Then
      expect(screen.queryByTestId('sheet-scroll-fade')).toBeNull();
      expect(scroll.props.showsVerticalScrollIndicator).toBe(false);
    });

    it('넘치면 아래쪽 흐림으로 더 있다고 알리고 끝까지 내리면 걷는다', async () => {
      // Given
      await renderUi(sheet);
      const scroll = await fitContent(400, 500);
      expect(screen.getByTestId('sheet-scroll-fade')).toBeTruthy();
      expect(scroll.props.showsVerticalScrollIndicator).toBe(true);

      // When
      await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 100 } } });

      // Then
      expect(screen.queryByTestId('sheet-scroll-fade')).toBeNull();
    });
  });
});
