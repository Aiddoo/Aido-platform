import { DeleteAccountForm } from '@src/features/identity/auth/components/delete-account-form';
import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { Box, ReadableContent, Spacing, VStack, WordWrapText } from '@src/shared/ui';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function DeleteAccountRoute() {
  const { t } = useTranslation('auth');

  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <DeleteAccountForm
          title={t('deleteAccount.passwordTitle')}
          footer={
            <Animated.View
              entering={FadeIn.duration(ANIMATION.duration.normal).delay(ANIMATION.delay.short)}
            >
              <Spacing size={16} />
              <VStack p={16} gap={4} className="bg-warning-1 rounded-xl">
                <WordWrapText size="b3" shade={7}>
                  {t('deleteAccount.restoreNotice')}
                </WordWrapText>
                <WordWrapText size="b3" shade={5}>
                  {t('deleteAccount.purgeNotice')}
                </WordWrapText>
              </VStack>
            </Animated.View>
          }
        />
      </ReadableContent>
    </Box>
  );
}
