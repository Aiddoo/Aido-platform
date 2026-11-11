import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useGetTodoSummaryQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { Button, InlineAlert, Text, Mascot } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { useIsInviteAvailable } from '../hooks/use-is-invite-available';
import { useOpenMyInvite } from '../hooks/use-open-my-invite';
import { allDoneBannerStoredValue } from '../schemas/all-done-banner-storage.schema';

/** 오늘 할 일을 다 끝낸 순간에 친구 초대를 권한다. 하루에 한 번 닫을 수 있다 */
export function InviteEntryBanner({
  className,
  ...props
}: Pick<ComponentProps<typeof InlineAlert>, 'className' | 'testID'>) {
  const { t } = useTranslation('invite');
  const todayKey = useTodayKey();
  const openMyInvite = useOpenMyInvite();
  const isInviteAvailable = useIsInviteAvailable();
  const userId = useMyAccountId();
  const { data: summary } = useQuery({
    ...useGetTodoSummaryQueryOptions({ date: todayKey, userId }),
    enabled: userId != null,
  });
  // 닫은 날은 저장소가 원본이다. 저장 값을 구독해 다른 화면에서 닫아도 따라간다
  const [dismissedOn, setDismissedOn] = useStoredValue(allDoneBannerStoredValue, userId);

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
      image={<Mascot name="catHi" size={72} />}
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
      onClose={() => setDismissedOn(todayKey)}
      closeLabel={t('entry.allDoneDismiss')}
      {...props}
    />
  );
}
