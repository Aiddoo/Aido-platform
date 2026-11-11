import '@src/shared/i18n/init';
import { zodResolver } from '@hookform/resolvers/zod';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { useForm } from 'react-hook-form';

import { signUpFormSchema, type SignUpFormValues } from '../schemas/sign-up-form.schema';
import { TermsAgreementBottomSheet } from './terms-agreement-bottom-sheet';

const SUBMIT = '동의하고 시작하기';

function Harness({ onValues }: { onValues: (values: SignUpFormValues) => void }) {
  const form = useForm({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      email: 'user@example.com',
      password: 'Password123',
      passwordConfirm: 'Password123',
      name: '아이두',
      termsAgreed: false,
      privacyAgreed: false,
      isMarketingAgreed: false,
    },
  });

  return (
    <TermsAgreementBottomSheet
      form={form}
      isOpen
      onOpenChange={noop}
      onSubmit={async () => {
        onValues(form.getValues());
        return true;
      }}
    />
  );
}

async function renderSheet() {
  const onValues = jest.fn();
  await renderScreen(
    <OverlayProvider>
      <Harness onValues={onValues} />
    </OverlayProvider>,
  );
  return { onValues };
}

describe('TermsAgreementBottomSheet', () => {
  it('필수 두 개를 켜기 전에는 시작할 수 없고, 켜면 선택 묶음 없이도 시작한다', async () => {
    // Given
    const { onValues } = await renderSheet();
    expect(await screen.findByRole('button', { name: SUBMIT })).toBeDisabled();
    fireEvent.press(screen.getByText('[필수] 이용약관'));
    await waitFor(() => expect(screen.getByRole('button', { name: SUBMIT })).toBeDisabled());

    // When
    fireEvent.press(screen.getByText('[필수] 개인정보 수집·이용'));
    await waitFor(() => expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled());
    fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    await waitFor(() =>
      expect(onValues).toHaveBeenCalledWith(
        expect.objectContaining({
          termsAgreed: true,
          privacyAgreed: true,
          isMarketingAgreed: false,
        }),
      ),
    );
  });

  it('모두 동의는 선택 묶음까지 켜고, 선택만 다시 끌 수 있다', async () => {
    // Given
    const { onValues } = await renderSheet();
    fireEvent.press(await screen.findByText('모두 동의'));
    await waitFor(() => expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled());

    // When
    fireEvent.press(screen.getByText('[선택] 혜택·소식 받기 (앱 푸시·이메일)'));
    await waitFor(() => expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled());
    fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    await waitFor(() =>
      expect(onValues).toHaveBeenCalledWith(
        expect.objectContaining({
          termsAgreed: true,
          privacyAgreed: true,
          isMarketingAgreed: false,
        }),
      ),
    );
  });
});
