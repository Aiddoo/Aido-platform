import { t } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';
import { getLastGorhomSheetProps, gorhomForceClose } from '@src/testing/mocks/gorhom-bottom-sheet';
import { renderScreen } from '@src/testing/render';
import { act, render, screen } from '@testing-library/react-native';
import { BackHandler, Keyboard } from 'react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import { makeMutable } from 'react-native-reanimated';

import { BottomSheet } from './bottom-sheet';
import { SHEET_INDEX } from './bottom-sheet.constants';
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
    const { rerender } = await renderScreen(sheet(true));

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
    await renderScreen(
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
    await renderScreen(
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
    await renderScreen(
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
    await renderScreen(
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
    const view = await renderScreen(
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

describe('KeyboardBottomSheet 바깥 탭', () => {
  const BACKDROP_TAP_TEST_ID = 'keyboard-sheet-backdrop-tap';

  /** gorhom이 시트를 index까지 움직이고 backdrop을 그리는 것을 대신한다 */
  async function drawBackdrop(index: number = SHEET_INDEX.OPEN) {
    const { backdropComponent: Backdrop, animatedIndex } = getLastGorhomSheetProps();
    if (animatedIndex == null) {
      throw new Error('시트 index를 받지 않았어요');
    }
    await act(async () => animatedIndex.set(index));
    await renderScreen(
      <Backdrop animatedIndex={animatedIndex} animatedPosition={makeMutable(0)} />,
    );
  }

  it('열린 시트 바깥을 누르면 키보드를 내리고 시트를 닫는다', async () => {
    // Given
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    const onOpenChange = jest.fn();
    await renderScreen(
      <KeyboardBottomSheet isOpen onOpenChange={onOpenChange}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    await drawBackdrop();

    // When
    await act(async () => {
      const tap = createGestureController(BACKDROP_TAP_TEST_ID);
      tap.begin();
      tap.activate();
      tap.end();
    });

    // Then
    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(gorhomForceClose).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('닫기 요청 핸들러가 바뀐 뒤 바깥을 누르면 최신 핸들러만 부르고 시트를 직접 닫지 않는다', async () => {
    // Given
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    const previousRequest = jest.fn();
    const nextRequest = jest.fn();
    const view = await renderScreen(
      <KeyboardBottomSheet isOpen onOpenChange={jest.fn()} onDismissRequest={previousRequest}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    await view.rerender(
      <KeyboardBottomSheet isOpen onOpenChange={jest.fn()} onDismissRequest={nextRequest}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    await drawBackdrop();

    // When
    await act(async () => {
      const tap = createGestureController(BACKDROP_TAP_TEST_ID);
      tap.begin();
      tap.activate();
      tap.end();
    });

    // Then
    expect(nextRequest).toHaveBeenCalledTimes(1);
    expect(previousRequest).not.toHaveBeenCalled();
    expect(dismissKeyboard).not.toHaveBeenCalled();
    expect(gorhomForceClose).not.toHaveBeenCalled();
  });

  it('끌기로 넘어가 탭이 실패하면 시트를 닫지 않는다', async () => {
    // Given
    const onDismissRequest = jest.fn();
    await renderScreen(
      <KeyboardBottomSheet isOpen onOpenChange={jest.fn()} onDismissRequest={onDismissRequest}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    await drawBackdrop();

    // When
    await act(async () => {
      const tap = createGestureController(BACKDROP_TAP_TEST_ID);
      tap.begin();
      tap.fail();
    });

    // Then
    expect(onDismissRequest).not.toHaveBeenCalled();
  });

  it('gorhom이 backdrop 터치를 끈 닫힌 시트에서는 바깥 탭을 받지 않는다', async () => {
    // Given
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    const onDismissRequest = jest.fn();
    await renderScreen(
      <KeyboardBottomSheet isOpen onOpenChange={jest.fn()} onDismissRequest={onDismissRequest}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    await drawBackdrop(SHEET_INDEX.CLOSED);

    // When
    await act(async () => {
      const tap = createGestureController(BACKDROP_TAP_TEST_ID);
      tap.begin();
      tap.activate();
      tap.end();
    });

    // Then
    expect(onDismissRequest).not.toHaveBeenCalled();
    expect(dismissKeyboard).not.toHaveBeenCalled();
  });
});
