import aidoBannerImage from '@assets/images/aido_banner.webp';
import aidoNoBannerImage from '@assets/images/aido_no_banner.webp';
import { TodoNudgePolicy } from '@src/features/todo/models/todo-nudge.model';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { useOverlay } from '@src/shared/ui/Overlay';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { Image, Pressable } from 'react-native';
import { getTodoNudgeLimitQueryOptions } from '../queries/get-todo-nudge-limit-query-options';
import { NudgeLimitDialog } from './NudgeLimitDialog';

export function PokeBanner() {
  const { data: limitInfo } = useSuspenseQuery(getTodoNudgeLimitQueryOptions());
  const isLimitReached = TodoNudgePolicy.isLimitReached(limitInfo);

  const overlay = useOverlay();
  const handlePress = () => {
    if (isLimitReached) {
      overlay.open(({ isOpen, close, exit }) => (
        <NudgeLimitDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
        />
      ));
    }
  };

  const bannerText = isLimitReached
    ? {
        title: '오늘 콕 찌르기를 다 썼어요',
        description: '구독하면 무제한으로 찌를 수 있어요',
      }
    : {
        title: (
          <>
            친구를{' '}
            <Text size="b3" weight="bold" className="text-main">
              콕
            </Text>{' '}
            찌를까요?
          </>
        ),
        description: '잊고 있는 것 같다면 🐾 을 눌러 알림을 보내보세요!',
      };

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
