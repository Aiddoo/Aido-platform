import { AuthLinkRow } from '@src/features/identity/auth/components/auth-link-row';
import { EmailLoginForm } from '@src/features/identity/auth/components/email-login-form';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { H3, ReadableContent, Spacing, TextButton, Box, Mascot } from '@src/shared/ui';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EmailLoginScreen() {
  const { t } = useTranslation('auth');
  const push = useSingleTap(router.push);
  const { right: rightInset } = useSafeAreaInsets();

  return (
    <Box className="flex-1 overflow-hidden bg-white">
      <Mascot
        name="catHi"
        size={100}
        className="absolute top-0 z-10"
        style={{
          right: rightInset,
          transform: [{ translateX: 20 }, { translateY: 20 }, { rotate: '-60deg' }],
        }}
      />
      <ReadableContent flex={1}>
        <EmailLoginForm
          footer={
            <>
              <Spacing size={24} />

              <AuthLinkRow>
                <TextButton size="medium" onPress={() => push('/sign-up')}>
                  {t('emailLogin.signUp')}
                </TextButton>
                <TextButton size="medium" onPress={() => push('/(auth)/forgot-password')}>
                  {t('emailLogin.forgotPassword')}
                </TextButton>
              </AuthLinkRow>
            </>
          }
        >
          <H3 align="center">{t('emailLogin.title')}</H3>

          {/* oxlint-disable-next-line aido/spacing-scale -- 제목과 이메일 입력 사이 한 화면 전용 구역. 규격 단계 밖 60px을 쓴다 */}
          <Spacing size={60} />
        </EmailLoginForm>
      </ReadableContent>
    </Box>
  );
}
