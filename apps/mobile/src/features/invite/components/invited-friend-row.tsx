import { REDEMPTION_REJECTION_REASON } from '@aido/api';
import { useGetFriendQueryOptions } from '@src/features/friend/queries/get-friend-query-options';
import { NudgePawButton } from '@src/features/nudge/components/nudge-paw-button';
import { useGetRemindNudgeCooldownQueryOptions } from '@src/features/nudge/queries/get-remind-nudge-cooldown-query-options';
import { remindNudgeSheetHref } from '@src/features/nudge/utils/navigation/nudge-href';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  CheckmarkIcon,
  FishIcon,
  HStack,
  ListRow,
  type ListRowProps,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
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
        // 행마다 끝에는 하나만 둔다. 폭을 같게 잡아 칩·버튼이 바뀌어도 설명 줄바꿈과 행 높이가 그대로다
        <Box className="min-w-[84px] items-end">
          {InvitedFriendPolicy.pawPrintState(friend) === 'waiting' ? (
            <InvitedFriendWaitingAction friend={friend} />
          ) : (
            <InvitedFriendPawPrintChip friend={friend} />
          )}
        </Box>
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
          <CheckmarkIcon width={11} height={11} colorClassName="text-white dark:text-gray-9" />
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
 * 발자국을 기다리는 친구의 끝 칸. 지금 콕 찌를 수 있으면 [콕 찌르기]만, 아니면(친구 목록에 없음·친구 끊김·차단,
 * 독촉 쿨다운, 불러오는 중) 남은 일수 칩을 둔다. 남은 일수는 설명 문구에도 있다
 */
function InvitedFriendWaitingAction({ friend }: { friend: InvitedFriend }) {
  const { data: myFriend } = useInfiniteQuery(
    useGetFriendQueryOptions({ friendId: friend.userId }),
  );
  const { data: cooldownInfo } = useQuery({
    ...useGetRemindNudgeCooldownQueryOptions({ userId: friend.userId }),
    enabled: myFriend != null,
  });

  return cooldownInfo?.canNudge === true ? (
    <InvitedFriendNudgeButton friend={friend} />
  ) : (
    <InvitedFriendPawPrintChip friend={friend} />
  );
}

/** 친구 독촉 콕 시트를 route로 연다. 보내고 나면 기존 콕 캐시가 쿨다운을 다시 읽어 칩으로 바뀐다 */
function InvitedFriendNudgeButton({ friend }: { friend: InvitedFriend }) {
  const { t } = useTranslation('invite');
  const push = useSingleTap(router.push);
  const displayName = InvitedFriendPolicy.displayName(friend);

  return (
    <NudgePawButton
      accessibilityLabel={t('friendList.nudgeLabel', {
        name: displayName,
        count: InvitedFriendPolicy.activeDaysLeft(friend),
      })}
      onPress={() => push(remindNudgeSheetHref({ id: friend.userId, displayName }))}
    />
  );
}
