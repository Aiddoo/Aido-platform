import ConfirmationNumber from '@expo/material-symbols/confirmation_number.xml';
import {
  SignUpForm,
  type SignUpStepContexts,
} from '@src/features/identity/auth/components/sign-up-form';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { ReadableContent, Box } from '@src/shared/ui';
import { router, Stack } from 'expo-router';

/** iOS는 글자 버튼, Android 툴바는 글자를 그리지 않아 아이콘을 쓴다 */
const INVITE_CODE_ICON = process.env.EXPO_OS === 'ios' ? undefined : ConfirmationNumber;

const SIGN_UP_STEP_TITLE_KEYS = {
  userInfo: 'auth:signUp.title',
  password: 'auth:signUp.passwordStepTitle',
  verification: 'auth:signUp.verificationStepTitle',
} as const satisfies Record<keyof SignUpStepContexts, string>;

export default function SignUpScreen() {
  const { t } = useTranslation(['auth', 'invite']);
  const stepper = useStepper<SignUpStepContexts>({
    initial: { step: 'userInfo', context: {} },
  });
  const openInviteCodeEntry = useSingleTap(() => router.push('/invite'));

  return (
    <Box className="flex-1 bg-white">
      <Stack.Screen options={{ title: t(SIGN_UP_STEP_TITLE_KEYS[stepper.step]) }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          hidden={stepper.step !== 'userInfo'}
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
