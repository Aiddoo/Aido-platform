import '@src/shared/i18n/init';
import { i18n } from '@src/shared/i18n';
import { createPurchasesGatewayStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { RestorePurchaseButton } from './restore-purchase-button';

describe('RestorePurchaseButton', () => {
  it('같은 프레임에 두 번 눌러도 스토어 복원은 한 번만 부른다', async () => {
    // Given
    const purchases = createPurchasesGatewayStub();
    purchases.restore.mockReturnValue(new Promise(() => {}));
    const di = createTestDi({ ports: { purchases } });
    di.purchasesSession.configure();
    // 결제 Provider처럼 결제 SDK에 로그인해 둔다. 로그인 전 결제는 막힌다
    await di.purchasesSession.logIn('user-1');
    await renderScreen(<RestorePurchaseButton />, { di, withOverlay: true });
    const button = screen.getByText('이전 구매 복원');

    // When
    await act(async () => {
      await fireEvent.press(button);
      await fireEvent.press(button);
    });

    // Then
    await waitFor(() => expect(purchases.restore).toHaveBeenCalled());
    expect(purchases.restore).toHaveBeenCalledTimes(1);
  });

  it('복원 중에 화면을 떠났다가 실패해도 문의로 잇는 실패 토스트를 띄운다', async () => {
    // Given
    const purchases = createPurchasesGatewayStub();
    let failRestore = (_error: Error) => {};
    purchases.restore.mockReturnValue(
      new Promise((_resolve, reject) => {
        failRestore = reject;
      }),
    );
    const di = createTestDi({ ports: { purchases } });
    di.purchasesSession.configure();
    await di.purchasesSession.logIn('user-1');
    await renderScreen(<LeavableRestoreButton />, { di, withOverlay: true });
    await act(async () => {
      await fireEvent.press(screen.getByText('이전 구매 복원'));
    });
    await waitFor(() => expect(purchases.restore).toHaveBeenCalled());

    // When
    await act(async () => {
      await fireEvent.press(screen.getByText('떠나기'));
    });
    await act(async () => {
      failRestore(new Error('store'));
    });

    // Then
    expect(await screen.findByText(i18n.t('subscription:failure.title.restore'))).toBeTruthy();
    expect(screen.getByText(i18n.t('subscription:failure.contactSupport'))).toBeTruthy();
  });
});

/** 복원 버튼이 있는 화면을 떠나는 것처럼 버튼만 내린다. 토스트 자리는 남는다 */
function LeavableRestoreButton() {
  const [isShown, setIsShown] = useState(true);

  return (
    <>
      {isShown && <RestorePurchaseButton />}
      <Text onPress={() => setIsShown(false)}>떠나기</Text>
    </>
  );
}
