import catHiImage from '@assets/images/ido_cat_hi.webp';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import type { User } from '@src/features/identity/user/schemas/user.schema';
import { useGetTodoSummaryQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Button, Image, InlineNotice, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type ComponentProps, useCallback, useSyncExternalStore } from 'react';

import { useInviteAvailability } from '../hooks/use-invite-availability';
import { useOpenMyInvite } from '../hooks/use-open-my-invite';

const selectUserId = (user: User) => user.id;

/** 오늘 할 일을 다 끝낸 순간에 친구 초대를 권한다. 하루에 한 번 닫을 수 있다 */
export function InviteEntryBanner({
  className,
  ...props
}: Pick<ComponentProps<typeof InlineNotice>, 'className' | 'testID'>) {
  const { t } = useTranslation('invite');
  const todayKey = useTodayKey();
  const inviteService = useInviteService();
  const openMyInvite = useOpenMyInvite();
  const isInviteAvailable = useInviteAvailability();
  const { data: userId } = useQuery({
    ...useGetMeQueryOptions(),
    throwOnError: false,
    select: selectUserId,
  });
  const { data: summary } = useQuery({
    ...useGetTodoSummaryQueryOptions({ date: todayKey, userId }),
    enabled: userId != null,
  });
  // 닫은 날은 저장소가 원본이다. 저장소 변경을 구독해 다른 화면에서 닫아도 따라간다
  const subscribeDismissal = useCallback(
    (listener: () => void) =>
      userId == null ? noop : inviteService.subscribeAllDoneBanner(userId, listener),
    [inviteService, userId],
  );
  const isDismissed = useSyncExternalStore(
    subscribeDismissal,
    () => userId != null && inviteService.isAllDoneBannerDismissed(userId, todayKey),
  );

  if (!isInviteAvailable || userId == null || summary?.isComplete !== true || isDismissed) {
    return null;
  }

  return (
    <InlineNotice
      className={className}
      image={
        <Image
          source={catHiImage}
          accessibilityIgnoresInvertColors
          className="size-[72px]"
          contentFit="contain"
        />
      }
      title={
        <>
          {t('entry.allDoneTitlePrefix')}{' '}
          <Text size="b3" weight="bold" className="text-main">
            {t('entry.allDoneTitleHighlight')}
          </Text>
        </>
      }
      description={t('entry.allDoneDescription')}
      action={
        <Button
          size="small"
          display="inline"
          radius="md"
          onPress={() => openMyInvite('all_done_banner')}
        >
          {t('entry.inviteFriends')}
        </Button>
      }
      onClose={() => inviteService.dismissAllDoneBanner(userId, todayKey)}
      closeLabel={t('entry.allDoneDismiss')}
      {...props}
    />
  );
}
