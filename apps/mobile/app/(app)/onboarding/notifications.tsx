import { PushPermissionOnboardingActions } from '@src/features/notification/components/push-permission-onboarding-actions';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  H3,
  NotificationIllustration,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';

/** 가입 직후 한 번만 열린다. 시스템 창을 흉내 내지 않고, 거절해도 앱은 그대로 쓸 수 있다 */
export default function NotificationOnboardingScreen() {
  const { t } = useTranslation('notification');

  return (
    <StyledSafeAreaView className="flex-1 bg-white" testID="push-onboarding-screen">
      <ReadableContent flex={1}>
        <VStack flex={1} align="center" justify="center" className="px-6">
          <NotificationIllustration />

          <Spacing size={20} />

          <H3 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
            {t('permission.onboarding.title')}
          </H3>

          <Spacing size={8} />

          <Text size="b3" shade={6} align="center">
            {t('permission.onboarding.description')}
          </Text>
        </VStack>

        <Box className="px-4 pb-4">
          <PushPermissionOnboardingActions />
        </Box>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
