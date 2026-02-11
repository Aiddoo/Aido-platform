import { TodoNudgePolicy } from '@src/features/todo/models/todo-nudge.model';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { useOverlay } from '@src/shared/ui/Overlay';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useQuery } from '@tanstack/react-query';
import { Image, Pressable } from 'react-native';
import { getTodoNudgeLimitQueryOptions } from '../queries/get-todo-nudge-limit-query-options';
import { NudgeLimitDialog } from './NudgeLimitDialog';

export function PokeBanner() {
  const { data: limitInfo } = useQuery(getTodoNudgeLimitQueryOptions());

  const isLimitReached = limitInfo ? TodoNudgePolicy.isLimitReached(limitInfo) : false;

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
          source={
            isLimitReached
              ? require('@assets/images/aido_no_banner.webp')
              : require('@assets/images/aido_banner.webp')
          }
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
