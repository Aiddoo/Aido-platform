import type { NudgeReplyKind } from '@aido/api';
import { UserReportPolicy } from '@src/features/moderation/domains/user-report.model';
import {
  blockUserConfirmHref,
  userReportSheetHref,
} from '@src/features/moderation/utils/navigation/moderation-href';
import { NudgeThanksButton } from '@src/features/nudge/components/nudge-interactions/nudge-thanks-button';
import {
  type NudgeInteraction,
  NudgeInteractionPolicy,
} from '@src/features/nudge/domains/nudge-interaction.model';
import {
  nudgeScreenParamsSchema,
  useNudgeScreenParams,
} from '@src/features/nudge/hooks/use-nudge-screen-params';
import { useGetNudgeInteractionQueryOptions } from '@src/features/nudge/queries/get-nudge-interaction-query-options';
import { useReplyToNudgeMutationOptions } from '@src/features/nudge/queries/use-reply-to-nudge-mutation-options';
import { getNudgeReplyLabelKey } from '@src/features/nudge/utils/nudge-reply-label';
import { todoThanksSheetHref } from '@src/features/todo/utils/navigation/todo-sheet-href';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { isApiError } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Button,
  CheckIcon,
  ClockIcon,
  HeartFilledIcon,
  HStack,
  PawIcon,
  QueryErrorBoundary,
  STACK_MORE_ICON,
  Result,
  StyledSafeAreaView,
  Text,
  TextSkeleton,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatRelativeTimeLabel } from '@src/shared/utils/date';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense, type ComponentProps } from 'react';
import { ScrollView } from 'react-native';
import { match, P } from 'ts-pattern';

function NudgeDetailScreen() {
  const { nudgeId } = useNudgeScreenParams();
  const [{ data: nudge }, { data: me }] = useSuspenseQueries({
    queries: [useGetNudgeInteractionQueryOptions({ nudgeId }), useGetMeQueryOptions()],
  });
  const { t } = useTranslation('todo');
  const dateFormatContext = useDateFormatContext();
  const isReceived = nudge.receiverId === me.id;
  const friendName = isReceived ? nudge.senderName : nudge.receiverName;
  const profileImage = isReceived ? nudge.senderProfileImage : nudge.receiverProfileImage;
  const status = NudgeInteractionPolicy.getStatus(nudge);
  const handleOpenThanksSheet = useSingleTap(() =>
    router.push(todoThanksSheetHref({ todoId: nudge.todoId })),
  );
  const handleOpenTodo = useSingleTap(() =>
    router.navigate({ pathname: '/todo/[todoId]', params: { todoId: nudge.todoId } }),
  );

  return (
    <>
      {isReceived && <NudgeModerationToolbar nudge={nudge} />}
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
        <VStack gap={24}>
          <HStack gap={12} align="center">
            <UserAvatar alt={friendName} className="size-12" profileImage={profileImage} />
            <VStack flex={1} gap={4}>
              <Text size="b3" weight="semibold">
                {t(isReceived ? 'interaction.from' : 'interaction.to', { name: friendName })}
              </Text>
              <Text size="e1" shade={5}>
                {formatRelativeTimeLabel(nudge.createdAt, new Date(), dateFormatContext)}
              </Text>
            </VStack>
          </HStack>

          <VStack gap={8}>
            <Text size="t3" weight="bold">
              {t('interaction.encouragementTitle')}
            </Text>
            {nudge.message != null && (
              <Text size="b3" shade={6}>
                {nudge.message}
              </Text>
            )}
          </VStack>

          <Button
            variant="weak"
            color="dark"
            isDisabled={nudge.todoTitle == null}
            className="p-4"
            onPress={handleOpenTodo}
          >
            <HStack align="center" gap={12} className="w-full">
              <PawIcon width={28} height={28} colorClassName="text-main" />
              <VStack flex={1} gap={4}>
                <Text size="b3" weight="semibold" maxLines={3}>
                  {nudge.todoTitle ?? t('interaction.unavailableTodo')}
                </Text>
                <Text size="e1" shade={5}>
                  {t(nudge.isTodoCompleted ? 'interaction.completed' : 'interaction.openTodo')}
                </Text>
              </VStack>
              <ArrowRightIcon width={18} height={18} colorClassName="text-gray-5" />
            </HStack>
          </Button>

          {match({
            status,
            isReceived,
            isTodoCompleted: nudge.isTodoCompleted,
            canReply: NudgeInteractionPolicy.isReplyable(nudge, me.id),
          })
            .with({ status: 'UNAVAILABLE' }, () => (
              <Result
                title={t('interaction.unavailable')}
                description={t('interaction.unavailableDescription')}
              />
            ))
            .with({ isReceived: true, isTodoCompleted: false, canReply: true }, () => (
              <NudgeDetailScreen.ReplyPanel nudge={nudge} />
            ))
            .with({ isReceived: true, isTodoCompleted: true }, () => (
              <VStack gap={12}>
                {status === 'THANKED' ? (
                  <NudgeDetailScreen.ThanksStatus />
                ) : (
                  <Text size="b3" shade={6}>
                    {t('interaction.completedThanksHint')}
                  </Text>
                )}
                {status !== 'THANKED' && <NudgeThanksButton onPress={handleOpenThanksSheet} />}
              </VStack>
            ))
            .with({ status: 'THANKED' }, () => <NudgeDetailScreen.ThanksStatus />)
            .with({ status: P.union('WAITING', 'REPLIED', 'COMPLETED', 'THANKED') }, () => (
              <Text size="b3" shade={6}>
                {match(nudge)
                  .with({ replyKind: P.nonNullable }, ({ replyKind }) =>
                    t('interaction.replyStatus', { reply: t(getNudgeReplyLabelKey(replyKind)) }),
                  )
                  .with({ isTodoCompleted: true }, () => t('interaction.completed'))
                  .otherwise(() => t('interaction.waiting'))}
              </Text>
            ))
            .exhaustive()}
        </VStack>
      </ScrollView>
    </>
  );
}

NudgeDetailScreen.ReplyPanel = function ReplyPanel({ nudge }: { nudge: NudgeInteraction }) {
  const { t } = useTranslation('todo');
  const { nudgeId } = useNudgeScreenParams();
  const replyMutation = useMutation(useReplyToNudgeMutationOptions());

  const handleReply = (replyKind: NudgeReplyKind) =>
    replyMutation.mutate({ nudgeId, input: { replyKind } });

  return (
    <VStack gap={12}>
      <Text size="b2" weight="bold">
        {t('interaction.replyTitle')}
      </Text>
      <Text size="b4" shade={5}>
        {t('interaction.replyHint')}
      </Text>
      <NudgeDetailScreen.ReplyButton
        value="STARTING"
        isSelected={nudge.replyKind === 'STARTING'}
        isDisabled={replyMutation.isPending}
        onPress={() => handleReply('STARTING')}
      />
      <NudgeDetailScreen.ReplyButton
        value="THANKFUL"
        isSelected={nudge.replyKind === 'THANKFUL'}
        isDisabled={replyMutation.isPending}
        onPress={() => handleReply('THANKFUL')}
      />
      <NudgeDetailScreen.ReplyButton
        value="LATER"
        isSelected={nudge.replyKind === 'LATER'}
        isDisabled={replyMutation.isPending}
        onPress={() => handleReply('LATER')}
      />
      {replyMutation.isError && (
        <Text size="b4" tone="danger" accessibilityLiveRegion="polite">
          {isApiError(replyMutation.error) ? replyMutation.error.message : t('toast.retryLater')}
        </Text>
      )}
      {replyMutation.isSuccess && (
        <Text size="b4" tone="brand" accessibilityLiveRegion="polite">
          {t('interaction.replySent')}
        </Text>
      )}
      <Text size="e1" shade={5}>
        {t('interaction.replyChangedHint')}
      </Text>
      <Text size="e1" shade={5}>
        {t('interaction.replyCompletionHint')}
      </Text>
    </VStack>
  );
};

NudgeDetailScreen.ThanksStatus = function ThanksStatus() {
  const { t } = useTranslation('todo');
  return (
    <HStack align="center" gap={8}>
      <HeartFilledIcon width={20} height={20} colorClassName="text-main" />
      <Text size="b3" tone="brand" className="shrink">
        {t('interaction.thanked')}
      </Text>
    </HStack>
  );
};

NudgeDetailScreen.ReplyButton = function ReplyButton({
  value,
  isSelected,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & {
  value: NudgeReplyKind;
  isSelected: boolean;
}) {
  const { t } = useTranslation('todo');
  const Icon = match(value)
    .with('STARTING', () => PawIcon)
    .with('THANKFUL', () => HeartFilledIcon)
    .with('LATER', () => ClockIcon)
    .exhaustive();
  return (
    <Button
      {...props}
      color={isSelected ? 'primary' : 'dark'}
      variant="weak"
      size="large"
      className={cn('border', isSelected ? 'border-main' : 'border-gray-2 bg-background')}
      accessibilityState={{ selected: isSelected, disabled: props.isDisabled }}
    >
      <HStack gap={12} align="center" className={cn('w-full', props.isDisabled && 'opacity-40')}>
        <Icon width={20} height={20} colorClassName="text-main" />
        <Text
          size="b3"
          weight="medium"
          className={isSelected ? 'text-main flex-1' : 'text-gray-9 flex-1'}
        >
          {t(getNudgeReplyLabelKey(value))}
        </Text>
        {isSelected && <CheckIcon width={20} height={20} colorClassName="text-main" />}
      </HStack>
    </Button>
  );
};

NudgeDetailScreen.Error = function ErrorState({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  const isUnavailable = isApiError(error) && error.status === 404;
  return (
    <VStack flex={1} p={24}>
      <Result
        title={t(isUnavailable ? 'todo:interaction.unavailable' : 'todo:interaction.loadError')}
        description={isUnavailable ? t('todo:interaction.unavailableDescription') : undefined}
        button={
          <Result.Button onPress={isUnavailable ? () => router.replace('/notifications') : reset}>
            {t(isUnavailable ? 'common:actions.goBack' : 'common:actions.retry')}
          </Result.Button>
        }
      />
    </VStack>
  );
};

NudgeDetailScreen.Loading = function Loading() {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
      <VStack gap={24}>
        <HStack gap={12} align="center">
          <Skeleton className="size-12 rounded-full" />
          <VStack flex={1} gap={4}>
            <TextSkeleton size="b3" className="w-40" />
            <TextSkeleton size="e1" className="w-16" />
          </VStack>
        </HStack>
        <TextSkeleton size="t3" className="w-3/4" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </VStack>
    </ScrollView>
  );
};

export default function NudgeDetailRoute() {
  const params = nudgeScreenParamsSchema.safeParse(useLocalSearchParams());
  const { t } = useTranslation('todo');

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-background">
      {params.success ? (
        <QueryErrorBoundary resetKeys={[params.data.nudgeId]} fallback={NudgeDetailScreen.Error}>
          <Suspense fallback={<NudgeDetailScreen.Loading />}>
            <NudgeDetailScreen />
          </Suspense>
        </QueryErrorBoundary>
      ) : (
        <VStack flex={1} p={24}>
          <Result title={t('interaction.unavailable')} />
        </VStack>
      )}
    </StyledSafeAreaView>
  );
}

/** 받은 콕 찌르기의 ⋯ 메뉴. 보낸 사람의 메시지를 신고하거나 보낸 사람을 차단한다 */
function NudgeModerationToolbar({ nudge }: { nudge: NudgeInteraction }) {
  const { t } = useTranslation('moderation');
  const push = useSingleTap(router.push);

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon={STACK_MORE_ICON} accessibilityLabel={t('menu.more')}>
        <Stack.Toolbar.MenuAction
          onPress={() =>
            push(
              userReportSheetHref({
                target: UserReportPolicy.nudgeMessageTarget({
                  nudgeId: nudge.id,
                  senderId: nudge.senderId,
                }),
                displayName: nudge.senderName,
              }),
            )
          }
        >
          {t('menu.report')}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          destructive
          onPress={() =>
            push(blockUserConfirmHref({ userId: nudge.senderId, displayName: nudge.senderName }))
          }
        >
          {t('block.action')}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
