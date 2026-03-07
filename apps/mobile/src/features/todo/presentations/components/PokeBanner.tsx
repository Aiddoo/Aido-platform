import aidoBannerImage from '@assets/images/aido_banner.webp';
import aidoNoBannerImage from '@assets/images/aido_no_banner.webp';
import { TodoNudgePolicy } from '@src/features/todo/models/todo-nudge.model';
import { useTrack } from '@src/shared/analytics';
import { HStack, Text, usePremiumDialog, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { Image, Pressable } from 'react-native';
import { match } from 'ts-pattern';
import { useGetTodoNudgeLimitQueryOptions } from '../queries/use-get-todo-nudge-limit-query-options';

export function PokeBanner() {
  const { data: limitInfo } = useSuspenseQuery(useGetTodoNudgeLimitQueryOptions());
  const bannerState = TodoNudgePolicy.getBannerState(limitInfo);
  const isLimitReached = bannerState.type === 'limitReached';

  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();
  const handlePress = () => {
    if (isLimitReached) {
      trackEvent('premium_gate_shown', { feature: 'nudge_limit' });
      premiumDialog.open({
        title: '오늘 콕 찌르기를 다 했어요',
        description: '구독하면 무제한으로 찌를 수 있어요',
      });
    }
  };

  const defaultTitle = (
    <>
      친구를{' '}
      <Text size="b3" weight="bold" className="text-main">
        콕
      </Text>{' '}
      찌를까요?
    </>
  );

  const bannerText = match(bannerState)
    .with({ type: 'limitReached' }, () => ({
      title: '오늘 콕 찌르기를 다 썼어요',
      description: '구독하면 무제한으로 찌를 수 있어요',
    }))
    .with({ type: 'available' }, () => ({
      title: defaultTitle,
      description: '잊고 있는 것 같다면 🐾 을 눌러 알림을 보내보세요!',
    }))
    .with({ type: 'remaining' }, ({ remainingToday }) => ({
      title: defaultTitle,
      description: `오늘 ${remainingToday}회 남았어요 (구독하면 무제한)`,
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
          <Text size="e1" shade={6}>
            {bannerText.description}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}

PokeBanner.Loading = function Loading() {
  return <Skeleton className="mx-4 h-[72px] rounded-xl" />;
};
