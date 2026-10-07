import type { NudgeReplyKind } from '@aido/api';
import { NudgeInteractionPolicy } from '@src/features/todo/models/nudge-interaction.model';
import { NudgeThanksButton } from '@src/features/todo/presentations/components/nudge-interactions/NudgeThanksButton';
import { useGetNudgeInteractionQueryOptions } from '@src/features/todo/presentations/queries/get-nudge-interaction-query-options';
import { useReplyToNudgeMutationOptions } from '@src/features/todo/presentations/queries/use-reply-to-nudge-mutation-options';
import { getNudgeReplyLabelKey } from '@src/features/todo/presentations/utils/nudge-reply-label';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { isApiError } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Avatar,
  Button,
  CheckIcon,
  ClockIcon,
  HeartFilledIcon,
  HStack,
  PawIcon,
  QueryErrorBoundary,
  Result,
  ScreenTitleBar,
  StyledSafeAreaView,
  Text,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense, type ComponentProps } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';
import { z } from 'zod';

const NudgeParamsSchema = z.object({ nudgeId: z.coerce.number().int().positive() });

export default function NudgeDetailScreen() {
  const params = NudgeParamsSchema.safeParse(useLocalSearchParams());
  const { t } = useTranslation('todo');
  const goBack = useSingleTap(() =>
    router.canGoBack() ? router.back() : router.replace('/notifications'),
  );

  return (
    <StyledSafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScreenTitleBar title={t('interaction.detailTitle')} onBackPress={goBack} />
      {params.success ? (
        <QueryErrorBoundary resetKeys={[params.data.nudgeId]} fallback={NudgeDetail.Error}>
          <Suspense fallback={<NudgeDetail.Loading />}>
            <NudgeDetail />
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

function NudgeDetail() {
  const { nudgeId } = NudgeParamsSchema.parse(useLocalSearchParams());
  const [{ data: nudge }, { data: me }] = useSuspenseQueries({
    queries: [useGetNudgeInteractionQueryOptions(nudgeId), useGetMeQueryOptions()],
  });
  const mutation = useMutation(useReplyToNudgeMutationOptions());
  const { t } = useTranslation('todo');
  const isReceived = nudge.receiverId === me.id;
  const friendName = isReceived ? nudge.senderName : nudge.receiverName;
  const profileImage = isReceived ? nudge.senderProfileImage : nudge.receiverProfileImage;
  const status = NudgeInteractionPolicy.getStatus(nudge);
  const reply = (replyKind: NudgeReplyKind) => mutation.mutate({ nudgeId, input: { replyKind } });
  const openTodo = useSingleTap(() =>
    router.navigate({ pathname: '/todo/[todoId]', params: { todoId: nudge.todoId } }),
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
      <VStack gap={24}>
        <HStack gap={12} align="center">
          <Avatar alt={friendName} className="size-12">
            <Avatar.Image source={getProfileIconSource(profileImage)} />
          </Avatar>
          <VStack flex={1} gap={4}>
            <Text size="b3" weight="semibold">
              {t(isReceived ? 'interaction.from' : 'interaction.to', { name: friendName })}
            </Text>
            <Text size="e1" shade={5}>
              {formatRelativeTime(nudge.createdAt)}
            </Text>
          </VStack>
        </HStack>

        <VStack gap={8}>
          <Text size="t3" weight="bold">
            {t('interaction.encouragementTitle')}
          </Text>
          {nudge.message !== null && (
            <Text size="b3" shade={6}>
              {nudge.message}
            </Text>
          )}
        </VStack>

        <Button
          variant="weak"
          color="dark"
          isDisabled={nudge.todoTitle === null}
          className="p-4"
          onPress={openTodo}
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

        {status === 'UNAVAILABLE' ? (
          <Result
            title={t('interaction.unavailable')}
            description={t('interaction.unavailableDescription')}
          />
        ) : isReceived &&
          !nudge.isTodoCompleted &&
          NudgeInteractionPolicy.isReplyable(nudge, me.id) ? (
          <VStack gap={12}>
            <Text size="b2" weight="bold">
              {t('interaction.replyTitle')}
            </Text>
            <Text size="b4" shade={5}>
              {t('interaction.replyHint')}
            </Text>
            <NudgeDetail.ReplyButton
              value="STARTING"
              isSelected={nudge.replyKind === 'STARTING'}
              isDisabled={mutation.isPending}
              onPress={() => reply('STARTING')}
            />
            <NudgeDetail.ReplyButton
              value="THANKFUL"
              isSelected={nudge.replyKind === 'THANKFUL'}
              isDisabled={mutation.isPending}
              onPress={() => reply('THANKFUL')}
            />
            <NudgeDetail.ReplyButton
              value="LATER"
              isSelected={nudge.replyKind === 'LATER'}
              isDisabled={mutation.isPending}
              onPress={() => reply('LATER')}
            />
            {mutation.isError && (
              <Text size="b4" tone="danger" accessibilityLiveRegion="polite">
                {isApiError(mutation.error) ? mutation.error.message : t('toast.retryLater')}
              </Text>
            )}
            {mutation.isSuccess && (
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
        ) : isReceived && nudge.isTodoCompleted ? (
          <VStack gap={12}>
            {status === 'THANKED' ? (
              <NudgeDetail.ThanksStatus />
            ) : (
              <Text size="b3" shade={6}>
                {t('interaction.completedThanksHint')}
              </Text>
            )}
            <NudgeThanksButton
              todoId={nudge.todoId}
              className={status === 'THANKED' ? 'hidden' : undefined}
            />
          </VStack>
        ) : status === 'THANKED' ? (
          <NudgeDetail.ThanksStatus />
        ) : (
          <Text size="b3" shade={6}>
            {nudge.replyKind !== null
              ? t('interaction.replyStatus', { reply: t(getNudgeReplyLabelKey(nudge.replyKind)) })
              : t(nudge.isTodoCompleted ? 'interaction.completed' : 'interaction.waiting')}
          </Text>
        )}
      </VStack>
    </ScrollView>
  );
}

NudgeDetail.ThanksStatus = function ThanksStatus() {
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

NudgeDetail.ReplyButton = function ReplyButton({
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
      className={`border ${isSelected ? 'border-main' : 'border-gray-2 bg-background'}`}
      accessibilityState={{ selected: isSelected, disabled: props.isDisabled }}
    >
      <HStack gap={12} align="center" className={`w-full ${props.isDisabled ? 'opacity-40' : ''}`}>
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

NudgeDetail.Error = function ErrorState({ error, reset }: QueryErrorFallbackProps) {
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

NudgeDetail.Loading = function Loading() {
  return (
    <VStack p={24} gap={24}>
      <HStack gap={12} align="center">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="w-40 h-5 rounded" />
      </HStack>
      <Skeleton className="w-3/4 h-8 rounded" />
      <Skeleton className="w-full h-20 rounded-2xl" />
      <Skeleton className="w-full h-12 rounded-2xl" />
      <Skeleton className="w-full h-12 rounded-2xl" />
      <Skeleton className="w-full h-12 rounded-2xl" />
    </VStack>
  );
};
