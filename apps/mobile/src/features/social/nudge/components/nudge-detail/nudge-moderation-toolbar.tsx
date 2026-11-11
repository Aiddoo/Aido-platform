import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { createNudgeMessageReportTarget } from '@src/features/social/moderation/domains/user-report.model';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { STACK_MENU_ICON, STACK_MORE_ICON } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';

import { NudgeInteractionPolicy } from '../../domains/nudge-interaction.model';
import { useNudgeId } from '../../hooks/use-nudge-id';
import { useGetNudgeInteractionQueryOptions } from '../../queries/todo-nudge.queries';

/** 받은 콕 찌르기의 ⋯ 메뉴. 보낸 사람의 메시지를 신고하거나 보낸 사람을 차단한다 */
export function NudgeModerationToolbar() {
  const [nudgeId] = useNudgeId();
  const { t } = useTranslation('moderation');
  const push = useSingleTap(router.push);
  const [{ data: nudge }, { data: me }] = useSuspenseQueries({
    queries: [useGetNudgeInteractionQueryOptions({ nudgeId }), useGetMeQueryOptions()],
  });

  if (!NudgeInteractionPolicy.isReceivedBy(nudge, me.id)) {
    return null;
  }

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon={STACK_MORE_ICON} accessibilityLabel={t('menu.more')}>
        <Stack.Toolbar.MenuAction
          icon={STACK_MENU_ICON.report}
          onPress={() => {
            const target = createNudgeMessageReportTarget({
              nudgeId: nudge.id,
              senderId: nudge.senderId,
            });
            push({
              pathname: '/users/[userId]/report',
              params: {
                userId: target.targetUserId,
                name: nudge.senderName,
                targetType: target.targetType,
                targetId: target.targetId,
              },
            });
          }}
        >
          {t('menu.report')}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={STACK_MENU_ICON.block}
          destructive
          onPress={() =>
            push({
              pathname: '/users/[userId]/block',
              params: { userId: nudge.senderId, name: nudge.senderName },
            })
          }
        >
          {t('block.action')}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
