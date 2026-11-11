import type { FriendUser } from '@src/features/social/friend/domains/friend.model';
import { useTranslation } from '@src/shared/i18n';
import { HStack, PawIcon, Result, Text, useOverlay } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';

import { useGetRemindNudgeCooldownQueryOptions } from '../queries/todo-nudge.queries';
import { RemindNudgeBottomSheet } from './nudge-bottom-sheet';

/** 오늘 할 일이 없는 친구에게 독촉 시트를 여는 버튼. 쿨다운 중이면 눌러지지 않는다 */
export function FriendRemindNudgeAction({ friend }: { friend: FriendUser }) {
  const { t } = useTranslation(['todo', 'friend']);
  const overlay = useOverlay();
  const { data: cooldownInfo } = useQuery(
    useGetRemindNudgeCooldownQueryOptions({ userId: friend.id }),
  );
  const canNudge = cooldownInfo?.canNudge ?? true;

  const openRemindNudgeSheet = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <RemindNudgeBottomSheet
        receiver={{ id: friend.id, displayName: friend.name ?? t('friend:fallbackName') }}
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            unmount();
          }
        }}
      />
    ));
  };

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
        {/* oxlint-disable-next-line aido/no-classname-concat -- 1.15.2 전환 #1400 */}
        <PawIcon width={16} height={16} colorClassName={canNudge ? 'text-main' : 'text-gray-5'} />
      </HStack>
    </Result.Button>
  );
}
