import catHiImage from '@assets/images/ido_cat_hi.webp';
import { useAllDoneBannerRepository } from '@src/bootstrap/providers/di-context';
import { type User } from '@src/features/identity/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useGetTodoSummaryQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Button, Image, InlineAlert, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type ComponentProps, useCallback, useSyncExternalStore } from 'react';

import { useIsInviteAvailable } from '../hooks/use-is-invite-available';
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
  const allDoneBannerRepository = useAllDoneBannerRepository();
  const openMyInvite = useOpenMyInvite();
  const isInviteAvailable = useIsInviteAvailable();
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
  const dismissedOn = useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        userId == null ? noop : allDoneBannerRepository.subscribe(userId, onChange),
      [allDoneBannerRepository, userId],
    ),
    () => (userId == null ? null : allDoneBannerRepository.findDismissedOn(userId)),
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
      onClose={() => allDoneBannerRepository.dismiss(userId, todayKey)}
      closeLabel={t('entry.allDoneDismiss')}
      {...props}
    />
  );
}
