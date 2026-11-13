import ConfirmationNumber from '@expo/material-symbols/confirmation_number.xml';
import {
  SignUpForm,
  type SignUpStepContexts,
} from '@src/features/identity/auth/components/sign-up-form/sign-up-form';
import { useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { ReadableContent, Box } from '@src/shared/ui';
import { router, Stack } from 'expo-router';

/** iOS는 글자 버튼, Android 툴바는 글자를 그리지 않아 아이콘을 쓴다 */
const INVITE_CODE_ICON = process.env.EXPO_OS === 'ios' ? undefined : ConfirmationNumber;

const SIGN_UP_STEP_TITLE_KEYS = {
  name: 'auth:signUp.title',
  email: 'auth:signUp.title',
  password: 'auth:signUp.passwordStepTitle',
  passwordConfirm: 'auth:signUp.passwordStepTitle',
  verification: 'auth:signUp.verificationStepTitle',
} as const satisfies Record<keyof SignUpStepContexts, string>;

export default function SignUpScreen() {
  const { t } = useTranslation(['auth', 'invite']);
  const { trackEvent } = useTrack();
  const stepper = useStepper<SignUpStepContexts>({
    id: 'sign-up',
    initial: { step: 'name' },
    onStepChange: ({ step }) => trackEvent('auth_signup_step_viewed', { step }),
  });
  const openInviteCodeEntry = useSingleTap(() => router.push('/invite'));

  const isUserInfoStep = stepper.step === 'name' || stepper.step === 'email';

  return (
    <Box className="flex-1 bg-white">
      <Stack.Screen options={{ title: t(SIGN_UP_STEP_TITLE_KEYS[stepper.step]) }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          hidden={!isUserInfoStep}
          icon={INVITE_CODE_ICON}
          accessibilityLabel={t('invite:entry.haveInviteCode')}
          onPress={openInviteCodeEntry}
        >
          {t('invite:entry.inviteCodeShort')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <ReadableContent flex={1}>
        <SignUpForm stepper={stepper} />
      </ReadableContent>
    </Box>
  );
}
