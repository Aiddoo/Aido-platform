import { type User, UserPolicy } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { HStack, ListRow, Text, usePremiumDialog, VStack } from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { Notification } from '../../models/notification.model';
import { NotificationPolicy } from '../../models/notification.model';
import { useMarkAsReadMutationOptions } from '../queries/use-mark-as-read-mutation-options';

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { mutate: markAsRead } = useMutation(useMarkAsReadMutationOptions());
  const router = useRouter();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const premiumDialog = usePremiumDialog();
  const isUnread = NotificationPolicy.isUnread(notification);
  const categoryLabel = NotificationPolicy.categoryLabel(notification);
  const relativeTime = formatRelativeTime(notification.createdAt);

  const handlePress = () => {
    // 1. 안 읽은 알림만 읽음 처리
    if (isUnread) markAsRead(notification.id);

    // 2. 외부 URL 처리
    const externalUrl = NotificationPolicy.getExternalUrl(notification);
    if (externalUrl) {
      Linking.openURL(externalUrl);
      return;
    }

    // 3. AI 기능 프리미엄 체크
    if (NotificationPolicy.isAiFeature(notification)) {
      const user = queryClient.getQueryData<User>(USER_QUERY_KEYS.me());
      if (user && !UserPolicy.isPremiumUser(user)) {
        trackEvent('premium_gate_shown', { feature: 'ai_report' });
        premiumDialog.open({
          description: '구독하면 AI 리포트와 제안을 확인할 수 있어요',
        });
        return;
      }
    }

    // 4. 타입 + context 기반 내부 라우팅
    const route = NotificationPolicy.internalRoute(notification);
    if (route) router.push(route as Href);
  };

  return (
    <Pressable onPress={handlePress}>
      <HStack className={isUnread ? 'bg-highlight' : 'bg-background'}>
        {/* 안읽음 인디케이터 바 */}
        {isUnread && <View className="w-[3.5px] bg-main self-stretch" />}

        <ListRow
          contents={
            <VStack gap={3}>
              <HStack justify="between" align="center">
                <Text
                  size="b4"
                  tone={isUnread ? 'brand' : 'neutral'}
                  shade={isUnread ? undefined : 5}
                  weight="medium"
                >
                  {categoryLabel}
                </Text>
                <Text size="b4" shade={5}>
                  {relativeTime}
                </Text>
              </HStack>

              <ListRow.Texts
                type="2RowTypeA"
                top={notification.title}
                topProps={{
                  weight: isUnread ? 'semibold' : 'medium',
                }}
                bottom={notification.body}
                bottomProps={{ size: 'b3', shade: isUnread ? 6 : 5, maxLines: 2 }}
              />
            </VStack>
          }
          className="flex-1 bg-transparent"
          horizontalPadding="medium"
          verticalPadding="large"
        />
      </HStack>
    </Pressable>
  );
}
