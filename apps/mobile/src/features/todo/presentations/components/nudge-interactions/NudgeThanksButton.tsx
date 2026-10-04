import { ErrorCode } from '@aido/errors';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  Avatar,
  Button,
  HeartFilledIcon,
  HStack,
  ModalBottomSheet,
  QueryErrorBoundary,
  Result,
  Text,
  VStack,
  useOverlay,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { Suspense, type ComponentProps } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';

import { NudgeInteractionPolicy } from '../../../models/nudge-interaction.model';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '../../queries/get-nudge-interaction-availability-query-options';
import { useGetNudgeThanksPreviewQueryOptions } from '../../queries/get-nudge-thanks-preview-query-options';
import { useSendNudgeThanksMutationOptions } from '../../queries/use-send-nudge-thanks-mutation-options';

type NudgeThanksButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & { todoId: number };

export function NudgeThanksButton({ todoId, onPress, ...props }: NudgeThanksButtonProps) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const availability = useQuery(useGetNudgeInteractionAvailabilityQueryOptions());
  if (!availability.data) return null;

  return (
    <Button
      {...props}
      variant={props.variant ?? 'weak'}
      color={props.color ?? 'primary'}
      onPress={(event) => {
        onPress?.(event);
        void overlay
          .open(({ isOpen, close, exit }) => (
            <NudgeThanksButton.Sheet
              todoId={todoId}
              isOpen={isOpen}
              onClose={close}
              onExit={exit}
            />
          ))
          .catch(() => undefined);
      }}
    >
      {t('interaction.thanksAction')}
    </Button>
  );
}

NudgeThanksButton.Sheet = function Sheet({
  todoId,
  ...props
}: Omit<ComponentProps<typeof ModalBottomSheet>, 'children'> & { todoId: number }) {
  const { t } = useTranslation('todo');
  return (
    <ModalBottomSheet {...props}>
      <VStack gap={16} pb={16}>
        <HStack align="center" gap={8}>
          <HeartFilledIcon width={20} height={20} colorClassName="text-main" />
          <Text size="b2" weight="bold">
            {t('interaction.thanksTitle')}
          </Text>
        </HStack>
        <QueryErrorBoundary
          resetKeys={[todoId]}
          fallback={(errorProps) => (
            <NudgeThanksButton.Error {...errorProps} onClose={props.onClose} />
          )}
        >
          <Suspense fallback={<NudgeThanksButton.Loading />}>
            <NudgeThanksButton.Recipients todoId={todoId} onSent={props.onClose} />
          </Suspense>
        </QueryErrorBoundary>
      </VStack>
    </ModalBottomSheet>
  );
};

NudgeThanksButton.Recipients = function Recipients({
  todoId,
  onSent,
}: {
  todoId: number;
  onSent: () => void;
}) {
  const { t } = useTranslation('todo');
  const { height } = useWindowDimensions();
  const { data: preview } = useSuspenseQuery(useGetNudgeThanksPreviewQueryOptions(todoId));
  const mutation = useMutation(useSendNudgeThanksMutationOptions());

  if (!NudgeInteractionPolicy.isThankable(preview)) return <NudgeThanksButton.Empty />;

  return (
    <VStack gap={16}>
      <Text size="b3" shade={6}>
        {t('interaction.thanksDescription', { count: preview.recipients.length })}
      </Text>
      <ScrollView style={{ maxHeight: height * 0.3 }}>
        <VStack gap={12}>
          {preview.recipients.map((recipient) => (
            <HStack key={recipient.id} align="center" gap={12}>
              <Avatar alt={recipient.name} className="size-10">
                <Avatar.Image source={getProfileIconSource(recipient.profileImage)} />
              </Avatar>
              <Text size="b3">{recipient.name}</Text>
            </HStack>
          ))}
        </VStack>
      </ScrollView>
      <Button
        color="primary"
        isLoading={mutation.isPending}
        onPress={() => {
          if (preview.throughNudgeId === null) return;
          mutation.mutate(
            { todoId, input: { throughNudgeId: preview.throughNudgeId } },
            { onSuccess: onSent },
          );
        }}
      >
        {t('interaction.thanksSend')}
      </Button>
    </VStack>
  );
};

NudgeThanksButton.Empty = function Empty() {
  const { t } = useTranslation('todo');
  return (
    <VStack py={24}>
      <Result
        title={t('interaction.thanksEmpty')}
        description={t('interaction.thanksEmptyDescription')}
      />
    </VStack>
  );
};

NudgeThanksButton.Error = function ErrorState({
  error,
  reset,
  onClose,
}: QueryErrorFallbackProps & { onClose: () => void }) {
  const { t } = useTranslation(['todo', 'common']);
  const hasChanged =
    isApiError(error) &&
    (error.status === 404 ||
      error.hasCode(ErrorCode.NUDGE_1109) ||
      error.hasCode(ErrorCode.NUDGE_1110));
  return (
    <VStack py={24}>
      <Result
        title={hasChanged ? error.message : t('todo:interaction.thanksLoadError')}
        button={
          <Result.Button onPress={hasChanged ? onClose : reset}>
            {t(hasChanged ? 'common:actions.close' : 'common:actions.retry')}
          </Result.Button>
        }
      />
    </VStack>
  );
};

NudgeThanksButton.Loading = function Loading() {
  return (
    <VStack gap={16} py={16}>
      <Skeleton className="w-full h-5 rounded" />
      <Skeleton className="w-1/2 h-10 rounded" />
      <Skeleton className="w-full h-12 rounded" />
    </VStack>
  );
};
