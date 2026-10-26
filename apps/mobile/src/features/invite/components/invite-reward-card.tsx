import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Box,
  HStack,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { type ComponentProps, Fragment, Suspense } from 'react';
import { match, P } from 'ts-pattern';

import { InvitePolicy } from '../domains/invite.model';
import { useInviteAvailability } from '../hooks/use-invite-availability';
import { useOpenMyInvite } from '../hooks/use-open-my-invite';
import { useGetInviteQueryOptions } from '../queries/get-invite-query-options';
import { createPawPrintBoard } from '../utils/view-models/invite-paw-print-board.view-model';
import { inviteRewardDotVariants } from './invite-reward-card.variants';

type InviteRewardCardProps = Omit<ComponentProps<typeof PressableFeedback>, 'onPress' | 'children'>;

// 마이페이지 카드에는 지금 판의 첫 줄 네 칸만 줄여 보여 준다
const PREVIEW_COLUMNS = 4;

/**
 * 마이페이지의 친구 초대 카드. 다른 진입점처럼 사용 가능 여부를 모르거나 묻지 못했으면 숨긴다.
 * 가능하다고 확인된 뒤에만 스켈레톤·오류를 보여 꺼진 기능의 오류 카드나 스켈레톤이 번쩍이지 않는다.
 * 사용 가능 여부는 홈 진입점이 먼저 불러 두어 보통 바로 정해진다.
 */
export function InviteRewardCard({ className, ...props }: InviteRewardCardProps) {
  const isAvailable = useInviteAvailability();

  if (!isAvailable) {
    return null;
  }

  return (
    <QueryErrorBoundary fallback={InviteRewardCard.Error}>
      <Suspense fallback={<InviteRewardCard.Loading className={className} />}>
        <InviteRewardCard.Contents className={className} {...props} />
      </Suspense>
    </QueryErrorBoundary>
  );
}

InviteRewardCard.Contents = function Contents({ className, ...props }: InviteRewardCardProps) {
  const { t } = useTranslation('invite');
  const { data: invite } = useSuspenseQuery(useGetInviteQueryOptions());
  const openMyInvite = useOpenMyInvite();
  const remaining = InvitePolicy.remainingToNextMilestone(invite);
  const [firstRow] = createPawPrintBoard(invite, {
    columns: PREVIEW_COLUMNS,
    celebratedCount: invite.qualifiedCount,
  }).rows;

  return (
    <PressableFeedback
      testID="mypage-invite-card"
      accessibilityRole="button"
      onPress={() => openMyInvite('mypage_card')}
      className={cn('rounded-[20px] bg-white p-4', className)}
      {...props}
    >
      <VStack gap={12}>
        <HStack align="center" justify="between" gap={12}>
          <VStack gap={2} className="flex-1">
            <Text size="b2" weight="bold">
              {t('entry.mypageTitle', { count: invite.qualifiedCount })}
            </Text>
            <Text size="b4" shade={7}>
              {match({ progress: InvitePolicy.progress(invite), remaining })
                .with({ progress: 'not-started' }, () => t('entry.mypageStart'))
                .with({ remaining: P.number }, ({ remaining: count }) =>
                  t('entry.mypageNext', { count }),
                )
                .with({ remaining: null }, () => t('entry.mypageKeepGoing'))
                .exhaustive()}
            </Text>
          </VStack>
          <ArrowRightIcon width={20} height={20} colorClassName="text-gray-5" />
        </HStack>

        <HStack align="center" accessibilityElementsHidden importantForAccessibility="no">
          {firstRow?.cells.map((cell, position) => (
            <Fragment key={cell.index}>
              {position > 0 && (
                <Box
                  className={cn(
                    'h-0.5 flex-1',
                    cell.connectorBefore?.isFilled === true ? 'bg-main/40' : 'bg-gray-2',
                  )}
                />
              )}
              <Box className={inviteRewardDotVariants({ state: cell.state })} />
            </Fragment>
          ))}
        </HStack>
      </VStack>
    </PressableFeedback>
  );
};

InviteRewardCard.Loading = function Loading({ className }: { className?: string }) {
  return (
    <VStack
      gap={12}
      className={cn('rounded-[20px] bg-white p-4', className)}
      accessibilityState={{ busy: true }}
    >
      <VStack gap={2}>
        <TextSkeleton size="b2" className="w-40" />
        <TextSkeleton size="b4" className="w-32" />
      </VStack>
      <Skeleton className="h-9 rounded-full" />
    </VStack>
  );
};

/** 카드와 같은 자리·높이에 다시 불러오기만 둔다 */
InviteRewardCard.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={12} className="mt-3 rounded-[20px] bg-white p-4">
      <VStack gap={2}>
        <Text size="b2" weight="bold">
          {t('result.loadFailed.title')}
        </Text>
        <Text size="b4" shade={7}>
          {t('result.loadFailed.description')}
        </Text>
      </VStack>
      <Box className="h-9 items-start justify-center">
        <TextButton size="small" onPress={reset}>
          {t('result.retry')}
        </TextButton>
      </Box>
    </VStack>
  );
};
