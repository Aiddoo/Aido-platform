import '@src/shared/i18n/init';
import { zodResolver } from '@hookform/resolvers/zod';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { useForm, useFormState, useWatch } from 'react-hook-form';

import { signUpFormSchema, type SignUpFormValues } from '../schemas/sign-up-form.schema';
import { TermsAgreementBottomSheet } from './terms-agreement-bottom-sheet';

const SUBMIT = '동의하고 시작하기';
const AGREEMENT_CHANGE = { shouldDirty: true, shouldValidate: true };

// 가입 화면과 같이 세 동의 칸을 폼에 잇는다
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
  const [termsAgreed, privacyAgreed, isMarketingAgreed] = useWatch({
    control: form.control,
    name: ['termsAgreed', 'privacyAgreed', 'isMarketingAgreed'],
  });
  const { isValid, isSubmitting } = useFormState({ control: form.control });

  return (
    <TermsAgreementBottomSheet
      isOpen
      onOpenChange={noop}
      value={{ termsAgreed, privacyAgreed, isMarketingAgreed }}
      onChange={(value) => {
        form.setValue('termsAgreed', value.termsAgreed, AGREEMENT_CHANGE);
        form.setValue('privacyAgreed', value.privacyAgreed, AGREEMENT_CHANGE);
        form.setValue('isMarketingAgreed', value.isMarketingAgreed, AGREEMENT_CHANGE);
      }}
      isSubmitDisabled={!isValid}
      isSubmitting={isSubmitting}
      onSubmit={() => onValues(form.getValues())}
    />
  );
}

async function renderSheet() {
  const onValues = jest.fn();
  await renderScreen(<Harness onValues={onValues} />, { withOverlay: true });
  return { onValues };
}

describe('TermsAgreementBottomSheet', () => {
  it('필수 두 개를 켜기 전에는 시작할 수 없고, 켜면 선택 묶음 없이도 시작한다', async () => {
    // Given
    const { onValues } = await renderSheet();
    expect(await screen.findByRole('button', { name: SUBMIT })).toBeDisabled();
    await fireEvent.press(screen.getByText('[필수] 이용약관'));
    await waitFor(() => expect(screen.getByRole('button', { name: SUBMIT })).toBeDisabled());

    // When
    await fireEvent.press(screen.getByText('[필수] 개인정보 수집·이용'));
    await waitFor(() => expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

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
    await fireEvent.press(await screen.findByText('모두 동의'));
    await waitFor(() => expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled());

    // When
    await fireEvent.press(screen.getByText('[선택] 혜택·소식 받기 (앱 푸시·이메일)'));
    await waitFor(() => expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

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
