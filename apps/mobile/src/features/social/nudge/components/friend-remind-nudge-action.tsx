import type { FriendUser } from '@src/features/social/friend/domains/friend.model';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, PawIcon, Result, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { useGetRemindNudgeCooldownQueryOptions } from '../queries/todo-nudge.queries';

/** 오늘 할 일이 없는 친구에게 독촉 시트를 여는 버튼. 쿨다운 중이면 눌러지지 않는다 */
export function FriendRemindNudgeAction({ friend }: { friend: FriendUser }) {
  const { t } = useTranslation(['todo', 'friend']);
  const fontScaledSize = useFontScaledSize();
  const { data: cooldownInfo } = useQuery(
    useGetRemindNudgeCooldownQueryOptions({ userId: friend.id }),
  );
  const push = useSingleTap(router.push);
  const canNudge = cooldownInfo?.canNudge ?? true;

  const openRemindNudgeSheet = () =>
    push({
      pathname: '/users/[userId]/nudge',
      params: { userId: friend.id, name: friend.name ?? t('friend:fallbackName') },
    });

  return (
    <Result.Button
      color="primary"
      variant="weak"
      onPress={openRemindNudgeSheet}
      isDisabled={!canNudge}
    >
      <HStack gap={6} align="center">
        <Text size="b4" weight="semibold" shade={canNudge ? undefined : 5}>
          {canNudge ? t('todo:friendTodo.nudge') : t('todo:friendTodo.alreadyNudged')}
        </Text>
        <PawIcon
          width={fontScaledSize(16)}
          height={fontScaledSize(16)}
          colorClassName={cn(canNudge ? 'text-main' : 'text-gray-5')}
        />
      </HStack>
    </Result.Button>
  );
}
