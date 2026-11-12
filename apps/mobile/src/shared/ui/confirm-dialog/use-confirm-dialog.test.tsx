import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { Pressable, Text } from 'react-native';

import { useConfirmDialog } from './use-confirm-dialog';

function Harness({
  onConfirm,
  onResult,
}: {
  onConfirm: () => Promise<void>;
  onResult: (isConfirmed: boolean) => void;
}) {
  const confirmDialog = useConfirmDialog();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        confirmDialog
          .openAsync({
            title: '삭제할까요?',
            confirmLabel: '삭제',
            cancelLabel: '취소',
            confirmTestID: 'confirm',
            onConfirm,
          })
          .then(onResult, noop);
      }}
    >
      <Text>open</Text>
    </Pressable>
  );
}

async function openDialog(onConfirm: () => Promise<void>) {
  const onResult = jest.fn();
  await renderScreen(<Harness onConfirm={onConfirm} onResult={onResult} />, { withOverlay: true });
  await fireEvent.press(screen.getByText('open'));
  await screen.findByText('삭제할까요?');

  return onResult;
}

// fireEvent.press는 onConfirm이 끝나야 풀린다. 닫히는 act 안에서 눌러 그리기만 마치고 약속은 쥔다
async function pressConfirm() {
  let confirmPress: Promise<void> = Promise.resolve();
  await act(async () => {
    confirmPress = fireEvent.press(screen.getByTestId('confirm'));
  });

  return { confirmPress };
}

describe('useConfirmDialog onConfirm', () => {
  it('실행하는 동안 열려 있고 취소할 수 없으며 끝나면 닫고 true를 돌려준다', async () => {
    // Given
    const deferred = Promise.withResolvers<void>();
    const onConfirm = jest.fn(() => deferred.promise);
    const onResult = await openDialog(onConfirm);

    // When
    const { confirmPress } = await pressConfirm();
    await fireEvent.press(screen.getByText('취소'));

    // Then
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // 진행 중에는 확인 버튼이 눌리지 않는 진행 상태다
    expect(screen.getByTestId('confirm')).toBeDisabled();
    expect(screen.getByText('삭제할까요?')).toBeOnTheScreen();
    expect(onResult).not.toHaveBeenCalled();

    // When
    await act(async () => {
      deferred.resolve();
      await confirmPress;
    });

    // Then
    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByText('삭제할까요?')).toBeNull();
  });

  it('onConfirm이 던지면 닫고 false를 돌려준다', async () => {
    // Given
    const deferred = Promise.withResolvers<void>();
    const onConfirm = jest.fn(() => deferred.promise);
    const onResult = await openDialog(onConfirm);

    // When
    const { confirmPress } = await pressConfirm();
    await act(async () => {
      deferred.reject(new Error('삭제 실패'));
      await confirmPress;
    });

    // Then
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.queryByText('삭제할까요?')).toBeNull();
  });
});
