import type { NudgeReplyKind } from '@aido/validators';
import { NudgeInteractionPolicy } from '@src/features/todo/models/nudge-interaction.model';
import { NudgeList } from '@src/features/todo/presentations/components/nudge-interactions/NudgeList';
import { NudgeThanksButton } from '@src/features/todo/presentations/components/nudge-interactions/NudgeThanksButton';
import { useGetNudgeInteractionQueryOptions } from '@src/features/todo/presentations/queries/get-nudge-interaction-query-options';
import { useReplyToNudgeMutationOptions } from '@src/features/todo/presentations/queries/use-reply-to-nudge-mutation-options';
import { getNudgeReplyLabelKey } from '@src/features/todo/presentations/utils/nudge-reply-label';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import type { QueryErrorFallbackProps } from '@src/shared/ui';
import {
  Avatar,
  Button,
  HStack,
  QueryErrorBoundary,
  Result,
  ScreenTitleBar,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Suspense, type ComponentProps } from 'react';
import { ScrollView } from 'react-native';
import { z } from 'zod';

const NudgeParamsSchema = z.object({ nudgeId: z.coerce.number().int().positive() });

export default function NudgeDetailScreen() {
  const params = NudgeParamsSchema.safeParse(useLocalSearchParams());
  const { t } = useTranslation('todo');

  return (
    <StyledSafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScreenTitleBar
        title={t('interaction.detailTitle')}
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/nudges'))}
      />
      {params.success ? (
        <QueryErrorBoundary resetKeys={[params.data.nudgeId]} fallback={NudgeDetail.Error}>
          <Suspense fallback={<NudgeList.Loading />}>
            <NudgeDetail />
          </Suspense>
        </QueryErrorBoundary>
      ) : (
        <Result title={t('interaction.unavailable')} />
      )}
    </StyledSafeAreaView>
  );
}

function NudgeDetail() {
  const { nudgeId } = NudgeParamsSchema.parse(useLocalSearchParams());
  const [{ data: nudge }, { data: me }] = useSuspenseQueries({
    queries: [useGetNudgeInteractionQueryOptions(nudgeId), useGetMeQueryOptions()],
  });
  const replyMutation = useMutation(useReplyToNudgeMutationOptions());
  const { t } = useTranslation('todo');
  const isReceived = nudge.receiverId === me.id;
  const friendName = isReceived ? nudge.senderName : nudge.receiverName;
  const profileImage = isReceived ? nudge.senderProfileImage : nudge.receiverProfileImage;
  const reply = (replyKind: NudgeReplyKind) =>
    replyMutation.mutate({ nudgeId, input: { replyKind } });

  return (
    <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
      <VStack gap={24}>
        <HStack gap={12} align="center">
          <Avatar alt={friendName} className="size-14">
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

        <VStack p={20} gap={16} className="rounded-2xl bg-gray-1">
          <Text size="b2" weight="semibold">
            {nudge.todoTitle ?? t('interaction.unavailableTodo')}
          </Text>
          {nudge.message && (
            <Text size="b3" shade={6}>
              {nudge.message}
            </Text>
          )}
          {nudge.isTodoCompleted && (
            <Text size="b4" tone="brand">
              {t('interaction.completed')}
            </Text>
          )}
          {nudge.todoTitle !== null && (
            <Button
              variant="weak"
              onPress={() =>
                router.push({ pathname: '/todo/[todoId]', params: { todoId: nudge.todoId } })
              }
            >
              {t('interaction.openTodo')}
            </Button>
          )}
        </VStack>

        {!nudge.isAvailable ? (
          <Result
            title={t('interaction.unavailable')}
            description={t('interaction.unavailableDescription')}
          />
        ) : NudgeInteractionPolicy.isReplyable(nudge, me.id) ? (
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
              isDisabled={replyMutation.isPending}
              onPress={() => reply('STARTING')}
            />
            <NudgeDetail.ReplyButton
              value="THANKFUL"
              isSelected={nudge.replyKind === 'THANKFUL'}
              isDisabled={replyMutation.isPending}
              onPress={() => reply('THANKFUL')}
            />
            <NudgeDetail.ReplyButton
              value="LATER"
              isSelected={nudge.replyKind === 'LATER'}
              isDisabled={replyMutation.isPending}
              onPress={() => reply('LATER')}
            />
            {nudge.replyKind && (
              <Text size="e1" shade={5}>
                {t('interaction.replyChangedHint')}
              </Text>
            )}
          </VStack>
        ) : (
          <Text size="b3" shade={6}>
            {nudge.replyKind
              ? t('interaction.replyStatus', { reply: t(getNudgeReplyLabelKey(nudge.replyKind)) })
              : t('interaction.waiting')}
          </Text>
        )}

        {nudge.thankedAt ? (
          <Text size="b3" tone="brand">
            {t('interaction.thanked')}
          </Text>
        ) : (
          isReceived &&
          nudge.isTodoCompleted &&
          nudge.isAvailable && <NudgeThanksButton todoId={nudge.todoId} />
        )}
      </VStack>
    </ScrollView>
  );
}

NudgeDetail.ReplyButton = function ReplyButton({
  value,
  isSelected,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & {
  value: NudgeReplyKind;
  isSelected: boolean;
}) {
  const { t } = useTranslation('todo');
  return (
    <Button
      {...props}
      color={isSelected ? 'primary' : 'dark'}
      variant="weak"
      accessibilityState={{ selected: isSelected, disabled: props.isDisabled }}
    >
      {t(getNudgeReplyLabelKey(value))}
    </Button>
  );
};

NudgeDetail.Error = function ErrorState({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todo');
  if (!isApiError(error) || error.status !== 404)
    return <NudgeList.Error error={error} reset={reset} />;
  return (
    <VStack flex={1} px={24}>
      <Result
        title={t('interaction.unavailable')}
        description={t('interaction.unavailableDescription')}
        button={
          <Result.Button onPress={() => router.replace('/nudges')}>
            {t('interaction.entry')}
          </Result.Button>
        }
      />
    </VStack>
  );
};
