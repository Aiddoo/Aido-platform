import { useTranslation } from '@src/shared/i18n';
import { CloseIcon, HStack, Text, VStack } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import { Pressable } from 'react-native';

import { useMarketingPushOptInPrompt } from '../hooks/use-marketing-push-opt-in-prompt';

/**
 * 광고성 앱 푸시 미동의자에게 feed에서 비침습적으로 동의를 재요청하는 배너 (순수 표현).
 *
 * 노출 여부·상호작용은 useMarketingPushOptInPrompt가 소유하고, 이 컴포넌트는 렌더만 한다.
 */
export function MarketingPushOptInBanner() {
  const { t } = useTranslation('notification');
  const { visible, open, dismiss } = useMarketingPushOptInPrompt();

  if (!visible) {
    return null;
  }

  return (
    <HStack align="center" gap={12} className="mx-4 mb-3 rounded-xl bg-gray-1 px-4 py-3.5">
      <Pressable onPress={open} className="flex-1">
        <VStack gap={2}>
          <Text size="b3" weight="medium">
            {t('marketingOptIn.bannerTitle')}
          </Text>
          <Text size="e1" shade={6}>
            {t('marketingOptIn.bannerDescription')}
          </Text>
        </VStack>
      </Pressable>

      <PressableFeedback onPress={dismiss} hitSlop={8}>
        <CloseIcon width={20} height={20} colorClassName="text-gray-6" />
      </PressableFeedback>
    </HStack>
  );
}
