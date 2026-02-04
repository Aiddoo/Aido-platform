import type { Notification } from '@src/features/notification/models/notification.model';
import { NotificationPolicy } from '@src/features/notification/models/notification.model';
import { markAsReadMutationOptions } from '@src/features/notification/presentations/queries/mark-as-read-mutation-options';
import { useMutation } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

interface NotificationListItemProps {
  notification: Notification;
}

export const NotificationListItem = ({ notification }: NotificationListItemProps) => {
  const { mutate: markAsRead, isPending } = useMutation(markAsReadMutationOptions());

  const isUnread = NotificationPolicy.isUnread(notification);

  const handlePress = () => {
    if (isUnread && !isPending) {
      markAsRead(notification.id);
    }
  };

  const formattedDate = notification.createdAt.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Pressable
      onPress={handlePress}
      className={`px-4 py-3 border-b border-gray-2 ${isUnread ? 'bg-blue-50' : 'bg-white'}`}
      disabled={isPending}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className={`text-base ${isUnread ? 'font-semibold text-gray-9' : 'text-gray-7'}`}>
            {notification.title}
          </Text>
          <Text className="text-sm text-gray-6 mt-1" numberOfLines={2}>
            {notification.body}
          </Text>
          <Text className="text-xs text-gray-5 mt-2">{formattedDate}</Text>
        </View>
        {isUnread && <View className="w-2 h-2 rounded-full bg-blue-500 mt-2" />}
      </View>
    </Pressable>
  );
};
