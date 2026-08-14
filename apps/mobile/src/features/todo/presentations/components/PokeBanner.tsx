import aidoBannerImage from '@assets/images/aido_banner.webp';
import aidoNoBannerImage from '@assets/images/aido_no_banner.webp';
import { TodoNudgePolicy } from '@src/features/todo/models/todo-nudge.model';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { HStack, PawIcon, Text, usePremiumDialog, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { Image, Pressable } from 'react-native';
import { match } from 'ts-pattern';

import { useGetTodoNudgeLimitQueryOptions } from '../queries/use-get-todo-nudge-limit-query-options';

export function PokeBanner() {
  const { t } = useTranslation('todo');
  const { data: limitInfo } = useSuspenseQuery(useGetTodoNudgeLimitQueryOptions());
  const bannerState = TodoNudgePolicy.getBannerState(limitInfo);
  const isLimitReached = bannerState.type === 'limitReached';

  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();
  const handlePress = () => {
    if (isLimitReached) {
      trackEvent('premium_gate_shown', { feature: 'nudge_limit' });
      premiumDialog.open({
        title: t('nudge.limitTitle'),
        description: t('nudge.subscribeUnlimited'),
      });
    }
  };

  const defaultTitle = (
    <>
      {t('nudge.promptPrefix')}{' '}
      <Text size="b3" weight="bold" className="text-main">
        {t('nudge.promptHighlight')}
      </Text>{' '}
      {t('nudge.promptSuffix')}
    </>
  );

  const bannerText = match(bannerState)
    .with({ type: 'limitReached' }, () => ({
      title: t('nudge.limitSpentTitle') as React.ReactNode,
      description: (
        <Text size="e1" shade={6}>
          {t('nudge.subscribeUnlimited')}
        </Text>
      ),
    }))
    .with({ type: 'available' }, () => ({
      title: defaultTitle,
      description: (
        <HStack gap={2} align="center" className="flex-wrap">
          <Text size="e1" shade={6}>
            {t('nudge.hintPrefix')}
          </Text>
          <PawIcon width={12} height={12} colorClassName="text-gray-6" />
          <Text size="e1" shade={6}>
            {t('nudge.hintSuffix')}
          </Text>
        </HStack>
      ),
    }))
    .with({ type: 'remaining' }, ({ remainingToday }) => ({
      title: defaultTitle,
      description: (
        <Text size="e1" shade={6}>
          {t('nudge.remaining', { count: remainingToday })}
        </Text>
      ),
    }))
    .exhaustive();

  return (
    <Pressable onPress={handlePress} disabled={!isLimitReached}>
      <HStack mx={16} px={12} className="rounded-xl bg-gray-1" align="center" gap={12}>
        <Image
          source={isLimitReached ? aidoNoBannerImage : aidoBannerImage}
          className="size-[72px]"
          resizeMode="contain"
        />
        <VStack flex={1}>
          <Text size="b3" weight="medium">
            {bannerText.title}
          </Text>
          {bannerText.description}
        </VStack>
      </HStack>
    </Pressable>
  );
}

PokeBanner.Loading = function Loading() {
  return <Skeleton className="mx-4 h-[72px] rounded-xl" />;
};
