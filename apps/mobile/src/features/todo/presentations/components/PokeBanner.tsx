import aidoBannerImage from '@assets/images/aido_banner.webp';
import aidoNoBannerImage from '@assets/images/aido_no_banner.webp';
import { TodoNudgePolicy } from '@src/features/todo/models/todo-nudge.model';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { usePremiumDialog } from '@src/shared/ui/PremiumDialog';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { Image, Pressable } from 'react-native';
import { match } from 'ts-pattern';
import { getTodoNudgeLimitQueryOptions } from '../queries/get-todo-nudge-limit-query-options';

export function PokeBanner() {
  const { data: limitInfo } = useSuspenseQuery(getTodoNudgeLimitQueryOptions());
  const bannerState = TodoNudgePolicy.getBannerState(limitInfo);
  const isLimitReached = bannerState.type === 'limitReached';

  const premiumDialog = usePremiumDialog();
  const handlePress = () => {
    if (isLimitReached) {
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
  return (
    <HStack mx={16} px={12} className="rounded-xl bg-gray-1" align="center" gap={12}>
      <Skeleton className="size-[72px] rounded-full" />
      <VStack flex={1} gap={4}>
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-4 w-full rounded" />
      </VStack>
    </HStack>
  );
};
