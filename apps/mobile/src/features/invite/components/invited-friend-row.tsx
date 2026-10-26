import { REDEMPTION_REJECTION_REASON } from '@aido/api';
import { useGetFriendQueryOptions } from '@src/features/friend/queries/get-friend-query-options';
import { useGetRemindNudgeCooldownQueryOptions } from '@src/features/nudge/queries/get-remind-nudge-cooldown-query-options';
import { createFeedHref } from '@src/features/todo/utils/feed-route';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FillCheckIcon,
  FishIcon,
  HStack,
  ListRow,
  type ListRowProps,
  PawIcon,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { match, P } from 'ts-pattern';

import { type InvitedFriend, InvitedFriendPolicy } from '../domains/invited-friend.model';
import {
  invitedFriendChipVariants,
  invitedFriendNudgeButtonVariants,
} from './invited-friend-row.variants';

interface InvitedFriendRowProps extends Omit<ListRowProps, 'left' | 'contents' | 'right'> {
  friend: InvitedFriend;
}

/** 초대한 친구 한 줄. 내 초대 요약과 전체 목록이 같은 행을 쓴다 */
export function InvitedFriendRow({ friend, ...props }: InvitedFriendRowProps) {
  const { t } = useTranslation('invite');
  const dateFormatContext = useDateFormatContext();
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

          <Text
            size="b4"
            shade={6}
            maxLines={2}
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="highQuality"
          >
            {match(InvitedFriendPolicy.pawPrintState(friend))
              .with('stamped', () =>
                t('friendList.stamped', {
                  date: formatDateLabel(
                    friend.qualifiedAt ?? friend.joinedAt,
                    'monthDay',
                    dateFormatContext,
                  ),
                }),
              )
              .with('waiting', () =>
                friend.activeDayCount === 0
                  ? t('friendList.waitingNotStarted', {
                      count: InvitedFriendPolicy.requiredActiveDays(),
                    })
                  : t('friendList.waiting', { count: InvitedFriendPolicy.activeDaysLeft(friend) }),
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
                t('friendList.joined', {
                  date: formatDateLabel(friend.joinedAt, 'monthDay', dateFormatContext),
                }),
              )
              .exhaustive()}
          </Text>
        </VStack>
      }
      right={
        <HStack align="center" gap={6}>
          {InvitedFriendPolicy.pawPrintState(friend) === 'waiting' && (
            <InvitedFriendNudgeButton friend={friend} />
          )}
          <InvitedFriendPawPrintChip friend={friend} />
        </HStack>
      }
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

/**
 * 발자국을 기다리는 친구를 콕 찌르러 그 친구의 오늘 피드로 간다. 할 일이 있으면 할 일에, 없으면 독촉으로
 * 기존 콕 찌르기 흐름이 그대로 고른다. 친구 목록에 없으면(친구 끊김·차단) 보이지 않는다
 */
function InvitedFriendNudgeButton({ friend }: { friend: InvitedFriend }) {
  const { t } = useTranslation('invite');
  const push = useSingleTap(router.push);
  const displayName = InvitedFriendPolicy.displayName(friend);
  const { data: myFriend, isPending } = useInfiniteQuery(
    useGetFriendQueryOptions({ friendId: friend.userId }),
  );
  const { data: cooldownInfo } = useQuery({
    ...useGetRemindNudgeCooldownQueryOptions({ userId: friend.userId }),
    enabled: myFriend != null,
  });

  if (!isPending && myFriend == null) {
    return null;
  }

  // 친구 목록을 불러오는 동안에도 자리를 잡아 두어 버튼이 나타날 때 설명 줄바꿈·행 높이가 바뀌지 않는다
  const isReady = !isPending;
  const canNudge = isReady && (cooldownInfo?.canNudge ?? true);

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={
        canNudge
          ? t('friendList.nudgeLabel', { name: displayName })
          : t('friendList.nudgedLabel', { name: displayName })
      }
      accessibilityState={{ disabled: !canNudge }}
      accessibilityElementsHidden={!isReady}
      importantForAccessibility={isReady ? 'auto' : 'no-hide-descendants'}
      isDisabled={!canNudge}
      onPress={() => push(createFeedHref({ friendId: friend.userId, date: 'today' }))}
      className={invitedFriendNudgeButtonVariants({ isDisabled: !canNudge, isReady })}
    >
      <PawIcon width={14} height={14} colorClassName={canNudge ? 'text-main' : 'text-gray-5'} />
      {canNudge || !isReady ? (
        <Text size="e1" weight="bold" tone="brand">
          {t('friendList.nudge')}
        </Text>
      ) : (
        <Text size="e1" weight="bold" shade={6}>
          {t('friendList.nudged')}
        </Text>
      )}
    </PressableFeedback>
  );
}
