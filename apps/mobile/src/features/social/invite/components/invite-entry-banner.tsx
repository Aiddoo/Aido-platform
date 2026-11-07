import catHiImage from '@assets/images/ido_cat_hi.webp';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import type { User } from '@src/features/identity/user/schemas/user.schema';
import { useGetTodoSummaryQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useSyncStorage } from '@src/shared/di/shared-di-context';
import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Button, Image, InlineAlert, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { createAllDoneBannerStorageKey } from '../apis/all-done-banner.repository';
import { useInviteAvailability } from '../hooks/use-invite-availability';
import { useOpenMyInvite } from '../hooks/use-open-my-invite';

function selectUserId(user: User) {
  return user.id;
}

/** 오늘 할 일을 다 끝낸 순간에 친구 초대를 권한다. 하루에 한 번 닫을 수 있다 */
export function InviteEntryBanner({
  className,
  ...props
}: Pick<ComponentProps<typeof InlineAlert>, 'className' | 'testID'>) {
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
  // 닫은 날은 저장소가 원본이다. 저장 값을 구독해 다른 화면에서 닫아도 따라간다
  const syncStorage = useSyncStorage();
  const [dismissedOn] = useSyncStorageString(
    syncStorage,
    createAllDoneBannerStorageKey(userId ?? ''),
  );

  if (
    !isInviteAvailable ||
    userId == null ||
    summary?.isComplete !== true ||
    dismissedOn === todayKey
  ) {
    return null;
  }

  return (
    <InlineAlert
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
