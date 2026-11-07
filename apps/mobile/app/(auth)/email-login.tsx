import idoCatHiImage from '@assets/images/ido_cat_hi.webp';
import { EmailLoginForm } from '@src/features/identity/auth/components/email-login-form';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { H3, HStack, Image, ReadableContent, Spacing, TextButton, Box } from '@src/shared/ui';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';

export default function EmailLoginScreen() {
  const { t } = useTranslation('auth');
  const push = useSingleTap(router.push);

  return (
    <Box className="flex-1 overflow-hidden bg-white">
      <Image
        source={idoCatHiImage}
        className="absolute right-0 top-0 z-10 h-[100px] w-[100px]"
        style={{ transform: [{ translateX: 20 }, { translateY: 20 }, { rotate: '-60deg' }] }}
        contentFit="contain"
      />
      <ReadableContent flex={1}>
        <EmailLoginForm
          footer={
            <>
              <Spacing size={24} />

              <HStack justify="center" align="center" gap={8}>
                <TextButton size="medium" onPress={() => push('/sign-up')}>
                  {t('emailLogin.signUp')}
                </TextButton>
                <Separator orientation="vertical" className="h-3 bg-gray-6" />
                <TextButton size="medium" onPress={() => push('/(auth)/forgot-password')}>
                  {t('emailLogin.forgotPassword')}
                </TextButton>
              </HStack>
            </>
          }
        >
          <H3 align="center">{t('emailLogin.title')}</H3>

          <Spacing size={60} />
        </EmailLoginForm>
      </ReadableContent>
    </Box>
  );
}
