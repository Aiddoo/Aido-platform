import {
  useIsMyPageMenuItemSelected,
  useMyPageMenuNavigate,
} from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  HStack,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { type ComponentProps, Fragment } from 'react';
import { match, P } from 'ts-pattern';

import { InvitePolicy } from '../domains/invite.model';
import { useOpenMyInvite } from '../hooks/use-open-my-invite';
import { useGetInviteQueryOptions } from '../queries/invite.queries';
import { createPawPrintBoard } from '../utils/invite-paw-print-board.geometry';
import { InvitePawPrintBoard } from './invite-paw-print-board';

type InviteRewardButtonProps = Omit<
  ComponentProps<typeof PressableFeedback>,
  'onPress' | 'children'
>;

// 마이페이지 카드에는 지금 판의 첫 줄 네 칸만 줄여 보여 준다
const PREVIEW_COLUMNS = 4;
const PREVIEW_CELL_SIZE = 44;

/** 마이페이지의 친구 초대 카드. 사용 가능 여부와 경계는 마이페이지가 정한다 */
export function InviteRewardButton({ className, ...props }: InviteRewardButtonProps) {
  const { t } = useTranslation('invite');
  const fontScaledSize = useFontScaledSize();
  const { data: invite } = useSuspenseQuery(useGetInviteQueryOptions());
  const openMyInvite = useOpenMyInvite();
  const navigate = useMyPageMenuNavigate();
  const isSelected = useIsMyPageMenuItemSelected('/friends/invite');
  const remaining = InvitePolicy.getRemainingToNextMilestone(invite);
  const [firstRow] = createPawPrintBoard(invite, {
    columns: PREVIEW_COLUMNS,
    celebratedCount: invite.qualifiedCount,
  }).rows;

  return (
    <PressableFeedback
      testID="mypage-invite-card"
      accessibilityRole="button"
      onPress={() => openMyInvite('mypage_card', navigate)}
      className={cn(
        'rounded-[20px] p-4',
        isSelected ? 'bg-gray-3 dark:bg-gray-2' : 'bg-gray-1',
        className,
      )}
      {...props}
    >
      <VStack gap={12}>
        <HStack align="center" justify="between" gap={12}>
          <VStack gap={2} className="flex-1">
            <Text size="b2" weight="bold">
              {t('entry.mypageTitle', { count: invite.qualifiedCount })}
            </Text>
            <Text
              size="b4"
              shade={7}
              lineBreakStrategyIOS="hangul-word"
              textBreakStrategy="highQuality"
            >
              {match({ progress: InvitePolicy.getProgress(invite), remaining })
                .with({ progress: 'not-started' }, () => t('entry.mypageStart'))
                .with({ remaining: P.number }, ({ remaining: count }) =>
                  t('entry.mypageNext', { count }),
                )
                .with({ remaining: null }, () => t('entry.mypageKeepGoing'))
                .exhaustive()}
            </Text>
          </VStack>
          <ArrowRightIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-gray-5"
          />
        </HStack>

        <HStack
          align="center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {firstRow?.cells.map((cell) => (
            <Fragment key={cell.index}>
              {cell.connectorBefore != null && (
                <InvitePawPrintBoard.Connector isFilled={cell.connectorBefore.isFilled} />
              )}
              <InvitePawPrintBoard.PawPrint
                cell={cell}
                size={PREVIEW_CELL_SIZE}
                newPawPrintOrder={0}
              />
            </Fragment>
          ))}
        </HStack>
      </VStack>
    </PressableFeedback>
  );
}

InviteRewardButton.Loading = function Loading({ className }: { className?: string }) {
  return (
    <VStack
      gap={12}
      className={cn('rounded-[20px] bg-gray-1 p-4', className)}
      accessibilityState={{ busy: true }}
    >
      <VStack gap={2}>
        <TextSkeleton size="b2" className="w-40" />
        <TextSkeleton size="b4" className="w-32" />
      </VStack>
      <Skeleton className="h-11 rounded-full dark:bg-gray-2" />
    </VStack>
  );
};

/** 카드와 같은 자리·높이에 다시 불러오기와 문의를 둔다 */
InviteRewardButton.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['invite', 'common']);

  return (
    <VStack gap={12} className="rounded-[20px] bg-gray-1 p-4">
      <VStack gap={2}>
        <Text size="b2" weight="bold">
          {t('invite:result.loadFailed.title')}
        </Text>
        <Text
          size="b4"
          shade={7}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {t('invite:result.loadFailed.description')}
        </Text>
      </VStack>
      <HStack gap={16} className="h-9 items-center">
        <TextButton size="small" onPress={reset}>
          {t('common:actions.retry')}
        </TextButton>
        <QueryErrorActions.Inquiry />
      </HStack>
    </VStack>
  );
};
