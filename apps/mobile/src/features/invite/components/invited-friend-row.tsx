import { REDEMPTION_REJECTION_REASON } from '@aido/api';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FillCheckIcon,
  FishIcon,
  HStack,
  ListRow,
  type ListRowProps,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatMonthDay } from '@src/shared/utils/date';
import { Skeleton } from 'heroui-native';
import { match, P } from 'ts-pattern';

import { type InvitedFriend, InvitedFriendPolicy } from '../domains/invited-friend.model';
import { invitedFriendChipVariants } from './invited-friend-row.variants';

interface InvitedFriendRowProps extends Omit<ListRowProps, 'left' | 'contents' | 'right'> {
  friend: InvitedFriend;
}

/** 초대한 친구 한 줄. 내 초대 요약과 전체 목록이 같은 행을 쓴다 */
export function InvitedFriendRow({ friend, ...props }: InvitedFriendRowProps) {
  const { t } = useTranslation('invite');
  const displayName = InvitedFriendPolicy.displayName(friend);

  return (
    <ListRow
      horizontalPadding="medium"
      left={<UserAvatar alt={displayName} className="size-10" profileImage={friend.profileImage} />}
      contents={
        <VStack gap={2} className="flex-1">
          <HStack align="center" gap={6}>
            <Text size="b2" weight="semibold" maxLines={1} className="shrink">
              {displayName}
            </Text>
            <Text size="b4" shade={6} className="tabular-nums tracking-[0.3px]">
              #{friend.userTag}
            </Text>
          </HStack>

          <Text size="b4" shade={6} maxLines={2}>
            {match(InvitedFriendPolicy.pawPrintState(friend))
              .with('stamped', () =>
                t('friendList.stamped', {
                  date: formatMonthDay(friend.qualifiedAt ?? friend.joinedAt),
                }),
              )
              .with('waiting', () =>
                t('friendList.waiting', {
                  done: friend.activeDayCount,
                  required: InvitedFriendPolicy.requiredActiveDays(),
                }),
              )
              .with('excluded', () =>
                match(friend.rejectionReason)
                  .with(REDEMPTION_REJECTION_REASON.EXPIRED, () =>
                    t('friendList.excludedExpired', {
                      days: InvitedFriendPolicy.qualificationWindowDays(),
                    }),
                  )
                  .with(REDEMPTION_REJECTION_REASON.INVITER_MONTHLY_CAP, () =>
                    t('friendList.excludedMonthlyCap'),
                  )
                  .with(P.nullish, () => t('friendList.excluded'))
                  .exhaustive(),
              )
              .with('unknown', () =>
                t('friendList.joined', { date: formatMonthDay(friend.joinedAt) }),
              )
              .exhaustive()}
          </Text>
        </VStack>
      }
      right={<InvitedFriendPawPrintChip friend={friend} />}
      {...props}
    />
  );
}

InvitedFriendRow.Loading = function Loading() {
  return (
    <ListRow
      horizontalPadding="medium"
      left={<Skeleton className="size-10 rounded-full" />}
      contents={<ListRow.Texts.Loading type="2RowTypeA" />}
      right={<Skeleton className="h-7 w-[72px] rounded-full" />}
    />
  );
};

/** 행 높이가 바뀌지 않게 칩이 없을 때도 같은 자리를 둔다 */
function InvitedFriendPawPrintChip({ friend }: { friend: InvitedFriend }) {
  const { t } = useTranslation('invite');

  return match(InvitedFriendPolicy.pawPrintState(friend))
    .with('stamped', () => (
      <Box
        className={invitedFriendChipVariants({ state: 'stamped' })}
        accessibilityLabel={t('friendList.chipDoneLabel')}
      >
        <Box className="size-5 items-center justify-center rounded-full bg-main">
          <FillCheckIcon width={11} height={11} colorClassName="text-white dark:text-gray-1" />
        </Box>
        <Text size="e1" weight="bold" tone="brand">
          {t('friendList.chipDone')}
        </Text>
      </Box>
    ))
    .with('waiting', () => (
      <Box
        className={invitedFriendChipVariants({ state: 'waiting' })}
        accessibilityLabel={t('friendList.chipWaitingLabel', {
          count: InvitedFriendPolicy.activeDaysLeft(friend),
        })}
      >
        <FishIcon width={16} height={10} colorClassName="text-main" />
        <Text size="e1" weight="bold" tone="brand" maxLines={1} className="tabular-nums">
          {t('friendList.chipWaiting', { count: InvitedFriendPolicy.activeDaysLeft(friend) })}
        </Text>
      </Box>
    ))
    .with('excluded', 'unknown', () => <Box className="min-h-7" />)
    .exhaustive();
}
