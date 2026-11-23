import { Text } from '@src/shared/ui';
import { dismissTopSheetByUser } from '@src/testing/mocks/react-native-true-sheet-reanimated';
import { renderScreen } from '@src/testing/render';
import { act, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { BottomSheet } from './bottom-sheet';
import { KeyboardBottomSheet } from './keyboard-bottom-sheet';

describe('BottomSheet 닫힘 알림', () => {
  it('열리기 전에 닫혀도 다 열린 뒤 닫아 닫혔다고 한 번 알려 route가 투명하게 남지 않는다', async () => {
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

  it('사용자가 끌어 내려 닫으면 닫기 시작을 먼저, 닫힘을 한 번 알린다', async () => {
    // Given
    const events: string[] = [];
    await renderScreen(
      <BottomSheet
        isOpen
        onCloseStart={() => events.push('close-start')}
        onOpenChange={(isOpen) => events.push(`open-change:${isOpen}`)}
      >
        <Text>내용</Text>
      </BottomSheet>,
    );

    // When
    await act(async () => dismissTopSheetByUser());

    // Then
    expect(events).toEqual(['close-start', 'open-change:false']);
  });
});

describe('KeyboardBottomSheet 닫기 요청', () => {
  it('닫기 요청 핸들러가 없으면 끌어 내려 닫을 때 키보드를 내리고 닫혔다고 알린다', async () => {
    // Given
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    const onOpenChange = jest.fn();
    await renderScreen(
      <KeyboardBottomSheet isOpen onOpenChange={onOpenChange}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );

    // When
    await act(async () => dismissTopSheetByUser());

    // Then
    expect(dismissKeyboard).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('닫기 요청 핸들러가 렌더마다 바뀌어도 끌어내림은 시트를 닫지 않고 최신 핸들러만 부른다', async () => {
    // Given
    const previousRequest = jest.fn();
    const nextRequest = jest.fn();
    const onOpenChange = jest.fn();
    const view = await renderScreen(
      <KeyboardBottomSheet isOpen onOpenChange={onOpenChange} onDismissRequest={previousRequest}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );
    await view.rerender(
      <KeyboardBottomSheet isOpen onOpenChange={onOpenChange} onDismissRequest={nextRequest}>
        <Text>내용</Text>
      </KeyboardBottomSheet>,
    );

    // When
    await act(async () => dismissTopSheetByUser());

    // Then
    expect(nextRequest).toHaveBeenCalledTimes(1);
    expect(previousRequest).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText('내용')).toBeOnTheScreen();
  });
});
