import '@src/shared/i18n/init';
import { createPurchasesGatewayStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

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
      fireEvent.press(button);
      fireEvent.press(button);
    });

    // Then
    await waitFor(() => expect(purchases.restore).toHaveBeenCalled());
    expect(purchases.restore).toHaveBeenCalledTimes(1);
  });
});
