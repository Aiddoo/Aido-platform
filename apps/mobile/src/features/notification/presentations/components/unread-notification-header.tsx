import { BellIcon, HStack, Text, TextButton } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Card, SkeletonGroup } from 'heroui-native';
import { useGetUnreadCountQueryOptions } from '../queries/use-get-unread-count-query-options';
import { useMarkAllAsReadMutationOptions } from '../queries/use-mark-all-as-read-mutation-options';

export function UnreadNotificationHeader() {
  const { data: unreadCount = 0 } = useSuspenseQuery(useGetUnreadCountQueryOptions());
  const markAllAsRead = useMutation(useMarkAllAsReadMutationOptions());

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Card className="mx-4 my-2">
      <HStack align="center" justify="between">
        <HStack align="center" gap={8}>
          <BellIcon width={18} height={18} colorClassName="text-main" />
          <HStack align="baseline" gap={4}>
            <Text size="b3" shade={7} weight="medium">
              읽지 않은 알림
            </Text>
            <Text size="b3" tone="brand" weight="bold">
              {unreadCount}건
            </Text>
          </HStack>
        </HStack>

        <TextButton
          size="medium"
          variant="underline"
          onPress={() => markAllAsRead.mutate()}
          isDisabled={markAllAsRead.isPending}
        >
          모두 읽음
        </TextButton>
      </HStack>
    </Card>
  );
}

UnreadNotificationHeader.Loading = function Loading() {
  return (
    <Card className="mx-4 my-2">
      <SkeletonGroup isLoading isSkeletonOnly>
        <HStack align="center" justify="between">
          <HStack align="center" gap={8}>
            <SkeletonGroup.Item className="w-[18px] h-[18px] rounded" />
            <SkeletonGroup.Item className="w-36 h-5 rounded" />
          </HStack>
          <SkeletonGroup.Item className="w-14 h-4 rounded" />
        </HStack>
      </SkeletonGroup>
    </Card>
  );
};
