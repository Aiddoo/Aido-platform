import '@src/shared/i18n/init';
import { zodResolver } from '@hookform/resolvers/zod';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { screen } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { useForm } from 'react-hook-form';

import { signUpFormSchema } from '../schemas/sign-up-form.schema';
import { TermsBottomSheet } from './terms-bottom-sheet';

const AGREEMENT_LABELS = [
  '서비스 이용약관 동의',
  '개인정보처리방침 동의',
  '마케팅 정보 수신 동의',
  '광고성 앱 푸시 수신 동의',
];
const AGREEMENT_LABEL_PATTERN = new RegExp(`^(${AGREEMENT_LABELS.join('|')})$`);

function TermsBottomSheetHarness() {
  const form = useForm({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      name: '',
      termsAgreed: false,
      privacyAgreed: false,
      marketingAgreed: false,
      marketingPushAgreed: false,
    },
  });

  return (
    <TermsBottomSheet
      form={form}
      isOpen
      onOpenChange={noop}
      onSubmit={() => Promise.resolve(true)}
    />
  );
}

describe('TermsBottomSheet', () => {
  it('필수 동의를 모두 위에, 선택 동의를 아래에 보여 준다', async () => {
    // Given
    await renderUi(
      <OverlayProvider>
        <TermsBottomSheetHarness />
      </OverlayProvider>,
    );

    // When
    const labels = screen
      .getAllByText(AGREEMENT_LABEL_PATTERN)
      .map((element) => element.props.children);

    // Then
    expect(labels).toEqual(AGREEMENT_LABELS);
  });
});
