import type { NudgeReplyKind } from '@aido/api/vocabulary';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  CheckIcon,
  ClockIcon,
  HeartFilledIcon,
  HStack,
  PawIcon,
  QueryErrorBoundary,
  Result,
  Text,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Suspense } from 'react';
import { match, P } from 'ts-pattern';

import { NUDGE_REPLY_LABEL_KEYS } from '../../constants/nudge-interaction-labels';
import { NudgeInteractionPolicy } from '../../domains/nudge-interaction.model';
import { useNudgeId } from '../../hooks/use-nudge-id';
import { useReplyToNudgeMutationOptions } from '../../queries/todo-nudge.mutations';
import { useGetNudgeInteractionQueryOptions } from '../../queries/todo-nudge.queries';
import { ThanksSummaryRow } from '../nudge-interactions/thanks-summary-row';

export function NudgeResponse() {
  const [nudgeId] = useNudgeId();
  const { t } = useTranslation('todo');
  const [{ data: nudge }, { data: me }] = useSuspenseQueries({
    queries: [useGetNudgeInteractionQueryOptions({ nudgeId }), useGetMeQueryOptions()],
  });
  const openThanksSheet = useSingleTap(() =>
    router.push({ pathname: '/todo/[todoId]/thanks', params: { todoId: nudge.todoId } }),
  );

  return match(NudgeInteractionPolicy.getResponseStage(nudge, me.id))
    .with('unavailable', () => (
      <Result
        title={t('interaction.unavailable')}
        description={t('interaction.unavailableDescription')}
      />
    ))
    .with('reply', () => <ReplyActions selectedKind={nudge.replyKind} />)
    .with('thanksPrompt', () => (
      <VStack gap={12}>
        <Text size="b3" shade={6}>
          {t('interaction.completedThanksHint')}
        </Text>
        <QueryErrorBoundary resetKeys={[nudge.todoId]} fallback={ThanksSummaryRow.Error}>
          {/* 쓸 수 있는지·보낼 대상이 있는지 조회한 뒤에야 보일지 알아, 자리를 잡으면 나타났다 사라져 아래가 움직인다 */}
          <Suspense fallback={null}>
            <ThanksSummaryRow todoId={nudge.todoId} onOpenThanks={openThanksSheet} />
          </Suspense>
        </QueryErrorBoundary>
      </VStack>
    ))
    .with('thanked', () => <ThanksStatus />)
    .with('status', () => (
      <Text size="b3" shade={6}>
        {match(nudge)
          .with({ replyKind: P.nonNullable }, ({ replyKind }) =>
            t('interaction.replyStatus', { reply: t(NUDGE_REPLY_LABEL_KEYS[replyKind]) }),
          )
          .with({ isTodoCompleted: true }, () => t('interaction.completed'))
          .otherwise(() => t('interaction.waiting'))}
      </Text>
    ))
    .exhaustive();
}

function ReplyActions({ selectedKind }: { selectedKind: NudgeReplyKind | null }) {
  const [nudgeId] = useNudgeId();
  const { t } = useTranslation('todo');
  const reply = useMutation(useReplyToNudgeMutationOptions());

  const sendReply = (replyKind: NudgeReplyKind) => reply.mutate({ nudgeId, input: { replyKind } });

  return (
    <VStack gap={12}>
      <Text size="b2" weight="bold">
        {t('interaction.replyTitle')}
      </Text>
      <Text size="b4" shade={5}>
        {t('interaction.replyHint')}
      </Text>
      <ReplyButton
        value="STARTING"
        isSelected={selectedKind === 'STARTING'}
        isDisabled={reply.isPending}
        onPress={() => sendReply('STARTING')}
      />
      <ReplyButton
        value="THANKFUL"
        isSelected={selectedKind === 'THANKFUL'}
        isDisabled={reply.isPending}
        onPress={() => sendReply('THANKFUL')}
      />
      <ReplyButton
        value="LATER"
        isSelected={selectedKind === 'LATER'}
        isDisabled={reply.isPending}
        onPress={() => sendReply('LATER')}
      />
      {reply.isSuccess && (
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
}

function ThanksStatus() {
  const { t } = useTranslation('todo');

  return (
    <HStack align="center" gap={8}>
      <HeartFilledIcon width={20} height={20} colorClassName="text-main" />
      <Text size="b3" tone="brand" className="shrink">
        {t('interaction.thanked')}
      </Text>
    </HStack>
  );
}

const REPLY_ICONS = {
  STARTING: PawIcon,
  THANKFUL: HeartFilledIcon,
  LATER: ClockIcon,
} satisfies Record<NudgeReplyKind, typeof PawIcon>;

type ReplyButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  value: NudgeReplyKind;
  isSelected: boolean;
};

function ReplyButton({ value, isSelected, ...props }: ReplyButtonProps) {
  const { t } = useTranslation('todo');
  const Icon = REPLY_ICONS[value];

  return (
    <Button
      {...props}
      color={isSelected ? 'primary' : 'dark'}
      variant="weak"
      size="large"
      className={cn('border', isSelected ? 'border-main' : 'border-gray-2 bg-white')}
      accessibilityState={{ selected: isSelected, disabled: props.isDisabled }}
    >
      <HStack gap={12} align="center" className={cn('w-full', props.isDisabled && 'opacity-40')}>
        <Icon width={20} height={20} colorClassName="text-main" />
        <Text
          size="b3"
          weight="medium"
          className={cn('flex-1', isSelected ? 'text-main' : 'text-gray-9')}
        >
          {t(NUDGE_REPLY_LABEL_KEYS[value])}
        </Text>
        {isSelected && <CheckIcon width={20} height={20} colorClassName="text-main" />}
      </HStack>
    </Button>
  );
}
