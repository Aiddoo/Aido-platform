import appIconImage from '@assets/images/profile-icons/default.webp';
import { SocialLoginButtons } from '@src/features/identity/auth/components/social-login-buttons';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  H1,
  HStack,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { router } from 'expo-router';
import { Avatar, Separator } from 'heroui-native';

export default function LoginScreen() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation(['auth', 'invite']);

  return (
    <StyledSafeAreaView className="flex-1 bg-white mb-2">
      <ReadableContent flex={1} px={16}>
        <VStack flex={1} align="center" justify="center" gap={8}>
          <Avatar alt={t('login.logoAlt')} size="lg" className="rounded-xl">
            <Avatar.Image source={appIconImage} />
          </Avatar>
          <VStack align="center">
            <H1>Aido</H1>
            <Text size="b4" shade={6}>
              {t('login.slogan')}
            </Text>
          </VStack>
        </VStack>

        <SocialLoginButtons />

        <Spacing size={24} />

        <HStack justify="center" align="center" gap={8}>
          <TextButton size="medium" onPress={() => push('/sign-up')}>
            {t('login.signUp')}
          </TextButton>

          <Separator orientation="vertical" className="h-3 bg-gray-6" />

          <TextButton size="medium" onPress={() => push('/email-login')} testID="login-email-entry">
            {t('login.emailLogin')}
          </TextButton>
        </HStack>

        <Spacing size={12} />

        {/* iOS는 설치 전 링크의 코드를 넘길 수 없어 웹에서 본 코드를 여기서 입력한다 */}
        <HStack justify="center" pb={40}>
          <TextButton size="small" variant="underline" onPress={() => push('/invite')}>
            {t('invite:entry.haveInviteCode')}
          </TextButton>
        </HStack>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
