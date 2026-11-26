import { INVITE_QUALIFICATION, REDEMPTION_REJECTION_REASON } from '@aido/api/vocabulary';
import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { UserHashtag } from '@src/features/identity/user/components/user-hashtag';
import { useGetFriendInfiniteQueryOptions } from '@src/features/social/friend/queries/friend.queries';
import { NudgePawButton } from '@src/features/social/nudge/components/nudge-paw-button';
import { useGetRemindNudgeCooldownQueryOptions } from '@src/features/social/nudge/queries/todo-nudge.queries';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
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
import { tv } from '@src/shared/utils/tv';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { match, P } from 'ts-pattern';

import { InvitedFriendPolicy } from '../domains/invited-friend.model';
import type { InvitedFriend } from '../domains/invited-friend.model';

const invitedFriendChipVariants = tv({
  base: 'min-h-7 flex-row items-center gap-1 rounded-full',
  variants: {
    state: {
      stamped: 'bg-main/10 pr-2.5 pl-1',
      waiting: 'border-[1.5px] border-dashed border-main px-2',
    },
  },
});

interface InvitedFriendRowProps extends Omit<ListRowProps, 'left' | 'contents' | 'right'> {
  friend: InvitedFriend;
}

export function InvitedFriendRow({ friend, ...props }: InvitedFriendRowProps) {
  const { t } = useTranslation('invite');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const displayName = friend.name ?? friend.userTag;

  return (
    <ListRow
      horizontalPadding="medium"
      left={<UserAvatar alt={displayName} className="size-10" profileImage={friend.profileImage} />}
      contents={
        <VStack gap={2} className="flex-1">
          <HStack align="center" gap={6}>
            <Text size="b2" weight="semibold" numberOfLines={1} className="shrink">
              {displayName}
            </Text>
            <UserHashtag
              userTag={friend.userTag}
              size="b4"
              shade={6}
              className="tracking-[0.3px] tabular-nums"
            />
          </HStack>

          <Text
            size="b4"
            shade={6}
            numberOfLines={2}
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="highQuality"
          >
            {match(InvitedFriendPolicy.getPawPrintState(friend))
              .with('stamped', () =>
                t('friendList.stamped', {
                  date: formatYearAwareDateLabel(
                    friend.qualifiedAt ?? friend.joinedAt,
                    todayKey,
                    dateFormatContext,
                  ),
                }),
              )
              .with('waiting', () =>
                InvitedFriendPolicy.hasStartedActiveDays(friend)
                  ? t('friendList.waiting', {
                      count: InvitedFriendPolicy.getActiveDaysLeft(friend),
                    })
                  : t('friendList.waitingNotStarted', {
                      count: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
                    }),
              )
              .with('excluded', () =>
                match(friend.rejectionReason)
                  .with(REDEMPTION_REJECTION_REASON.EXPIRED, () =>
                    t('friendList.excludedExpired', {
                      days: INVITE_QUALIFICATION.EXPIRE_AFTER_DAYS,
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
                  date: formatYearAwareDateLabel(friend.joinedAt, todayKey, dateFormatContext),
                }),
              )
              .exhaustive()}
          </Text>
        </VStack>
      }
      right={
        // 행마다 끝에는 하나만 둔다. 폭을 같게 잡아 칩·버튼이 바뀌어도 설명 줄바꿈과 행 높이가 그대로다
        <Box className="min-w-[84px] items-end">
          {InvitedFriendPolicy.getPawPrintState(friend) === 'waiting' ? (
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

InvitedFriendRow.Loading = function Loading(
  props: Omit<ListRowProps, 'left' | 'contents' | 'right'>,
) {
  return (
    <ListRow
      horizontalPadding="medium"
      left={<Skeleton className="size-10 rounded-full" />}
      contents={<ListRow.Texts.Loading type="2RowTypeA" />}
      right={<Skeleton className="h-7 w-[72px] rounded-full" />}
      {...props}
    />
  );
};

/** 행 높이가 바뀌지 않게 칩이 없을 때도 같은 자리를 둔다 */
function InvitedFriendPawPrintChip({ friend }: { friend: InvitedFriend }) {
  const { t } = useTranslation('invite');
  const fontScaledSize = useFontScaledSize();

  return match(InvitedFriendPolicy.getPawPrintState(friend))
    .with('stamped', () => (
      <Box
        className={invitedFriendChipVariants({ state: 'stamped' })}
        accessibilityLabel={t('friendList.chipDoneLabel')}
      >
        <Box className="size-5 items-center justify-center rounded-full bg-main">
          <CheckmarkIcon
            width={fontScaledSize(12)}
            height={fontScaledSize(12)}
            colorClassName="text-white dark:text-gray-9"
          />
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
          count: InvitedFriendPolicy.getActiveDaysLeft(friend),
        })}
      >
        <FishIcon
          width={fontScaledSize(16)}
          height={fontScaledSize(10)}
          colorClassName="text-main"
        />
        <Text size="e1" weight="bold" tone="brand" numberOfLines={1} className="tabular-nums">
          {t('friendList.chipWaiting', { count: InvitedFriendPolicy.getActiveDaysLeft(friend) })}
        </Text>
      </Box>
    ))
    .with('excluded', 'unknown', () => <Box className="min-h-7" />)
    .exhaustive();
}

/** 친구 목록에 없음·친구 끊김·차단, 독촉 쿨다운, 불러오는 중이면 콕 대신 남은 일수 칩을 둔다 */
function InvitedFriendWaitingAction({ friend }: { friend: InvitedFriend }) {
  const { data: myFriend } = useInfiniteQuery(
    useGetFriendInfiniteQueryOptions({ friendId: friend.userId }),
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

/** 보내고 나면 기존 콕 캐시가 쿨다운을 다시 읽어 칩으로 바뀐다 */
function InvitedFriendNudgeButton({ friend }: { friend: InvitedFriend }) {
  const { t } = useTranslation('invite');
  const router = useRouter();
  const push = useSingleTap(router.push);
  const displayName = friend.name ?? friend.userTag;

  return (
    <NudgePawButton
      accessibilityLabel={t('friendList.nudgeLabel', {
        name: displayName,
        count: InvitedFriendPolicy.getActiveDaysLeft(friend),
      })}
      onPress={() =>
        push({
          pathname: '/users/[userId]/nudge',
          params: { userId: friend.userId, name: displayName },
        })
      }
    />
  );
}
