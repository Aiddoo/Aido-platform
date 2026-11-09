import { renderUi } from '@src/shared/__tests__';
import { getLastGorhomSheetProps } from '@src/shared/__tests__/mocks/gorhom-bottom-sheet';
import { t } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';
import { act, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { BottomSheet } from './bottom-sheet';
import { KeyboardBottomSheet } from './keyboard-bottom-sheet';

describe('BottomSheet 닫힘 알림', () => {
  it('열리기 전에 닫혀도 닫혔다고 한 번 알려 route가 투명하게 남지 않는다', async () => {
    // Given
    const onOpenChange = jest.fn();
    const sheet = (isOpen: boolean) => (
      <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
        <Text>내용</Text>
      </BottomSheet>
    );
    const { rerender } = await renderUi(sheet(true));

    // When
    await rerender(sheet(false));
    await rerender(sheet(false));

    // Then
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('처음부터 닫혀 있으면 알리지 않는다', async () => {
    // Given
    const onOpenChange = jest.fn();

    // When
    await renderUi(
      <BottomSheet isOpen={false} onOpenChange={onOpenChange}>
        <Text>내용</Text>
      </BottomSheet>,
    );

    // Then
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('KeyboardBottomSheet 닫힘 알림', () => {
  it('열리는 도중에 닫혀 gorhom이 onClose만 불러도 닫혔다고 알려 route가 투명하게 남지 않는다', async () => {
    // Given
    const onOpenChange = jest.fn();
    await renderUi(
      <KeyboardBottomSheet isOpen onOpenChange={onOpenChange}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
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
      <KeyboardBottomSheet isOpen onOpenChange={onOpenChange}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
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

describe('KeyboardBottomSheet 시트 면', () => {
  it('gorhom이 pointerEvents none을 넘겨도 면이 터치를 받아 Android에서 뒤 backdrop까지 내려가지 않는다', async () => {
    // Given
    await renderUi(
      <KeyboardBottomSheet isOpen onOpenChange={jest.fn()}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    const SheetBackground = getLastGorhomSheetProps().backgroundComponent;

    // When
    await render(<SheetBackground pointerEvents="none" />);

    // Then
    expect(
      screen.getByLabelText(t('common:bottomSheet.label')).props.pointerEvents,
    ).toBeUndefined();
  });

  it('닫기 요청 핸들러가 렌더마다 바뀌어도 최신 것을 부르고 backdrop을 다시 만들지 않는다', async () => {
    // Given
    const subscribe = jest.spyOn(BackHandler, 'addEventListener');
    const previousRequest = jest.fn();
    const nextRequest = jest.fn();
    const onOpenChange = jest.fn();
    const view = await renderUi(
      <KeyboardBottomSheet isOpen onOpenChange={onOpenChange} onDismissRequest={previousRequest}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    const firstBackdrop = getLastGorhomSheetProps().backdropComponent;

    // When
    await view.rerender(
      <KeyboardBottomSheet isOpen onOpenChange={onOpenChange} onDismissRequest={nextRequest}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    const subscription = subscribe.mock.calls.at(-1);
    if (subscription == null) {
      throw new Error('뒤로가기 구독이 없어요');
    }
    await act(async () => subscription[1]({ type: 'hardwareBackPress', timeStamp: 0 }));
    subscribe.mockRestore();

    // Then
    expect(nextRequest).toHaveBeenCalledTimes(1);
    expect(previousRequest).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(getLastGorhomSheetProps().backdropComponent).toBe(firstBackdrop);
  });
});
