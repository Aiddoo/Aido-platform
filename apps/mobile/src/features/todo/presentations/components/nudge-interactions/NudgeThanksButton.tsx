import { ErrorCode } from '@aido/errors';
import { FlashList } from '@shopify/flash-list';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  Avatar,
  Box,
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
import { useMutation, useQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton, Spinner } from 'heroui-native';
import { Suspense, type ComponentProps } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  NudgeInteractionPolicy,
  type NudgeThanksPreview,
} from '../../../models/nudge-interaction.model';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '../../queries/get-nudge-interaction-availability-query-options';
import { useGetNudgeThanksPreviewInfiniteQueryOptions } from '../../queries/get-nudge-thanks-preview-infinite-query-options';
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
      <HStack align="center" justify="center" gap={8}>
        <HeartFilledIcon width={20} height={20} colorClassName="text-main" />
        <Text size="b4" tone="brand" weight="semibold" className="shrink">
          {t('interaction.thanksAction')}
        </Text>
      </HStack>
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
      <VStack gap={20} pb={16}>
        <HStack align="center" gap={8}>
          <HeartFilledIcon width={20} height={20} colorClassName="text-main" />
          <Text size="b2" weight="bold" className="shrink">
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
            <NudgeThanksButton.Recipients todoId={todoId} onClose={props.onClose} />
          </Suspense>
        </QueryErrorBoundary>
      </VStack>
    </ModalBottomSheet>
  );
};

NudgeThanksButton.Recipients = function Recipients({
  todoId,
  onClose,
}: {
  todoId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation(['todo', 'common']);
  const { height } = useWindowDimensions();
  const query = useSuspenseInfiniteQuery(useGetNudgeThanksPreviewInfiniteQueryOptions(todoId));
  const mutation = useMutation(useSendNudgeThanksMutationOptions());
  const preview = query.data.pages[0];
  const recipients = query.data.pages.flatMap((page) => page.recipients);

  if (mutation.isSuccess)
    return (
      <VStack gap={24} py={16}>
        <HStack align="center" gap={12}>
          <HeartFilledIcon width={28} height={28} colorClassName="text-main" />
          <Text size="b3" weight="semibold" className="shrink">
            {t(
              mutation.data > 0 ? 'todo:interaction.thanksSent' : 'todo:interaction.alreadyThanked',
            )}
          </Text>
        </HStack>
        <Button onPress={onClose}>{t('common:actions.done')}</Button>
      </VStack>
    );

  if (preview === undefined || !NudgeInteractionPolicy.isThankable(preview))
    return <NudgeThanksButton.Empty />;

  return (
    <VStack gap={20}>
      <Text size="b3" shade={6}>
        {t('todo:interaction.thanksDescription', { count: preview.totalRecipients })}
      </Text>
      <Box style={{ height: Math.min(height * 0.3, Math.max(72, recipients.length * 64)) }}>
        <FlashList
          data={recipients}
          keyExtractor={(recipient) => recipient.id}
          renderItem={({ item }) => <NudgeThanksButton.Recipient recipient={item} />}
          ListFooterComponent={
            query.isFetchNextPageError ? (
              <Button variant="weak" size="medium" onPress={() => void query.fetchNextPage()}>
                {t('common:actions.retry')}
              </Button>
            ) : query.isFetchingNextPage ? (
              <Box py={12}>
                <Spinner />
              </Box>
            ) : null
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError)
              void query.fetchNextPage({ cancelRefetch: false });
          }}
          onEndReachedThreshold={0.5}
        />
      </Box>
      <Text size="e1" shade={5}>
        {t('todo:interaction.thanksSelectionHint')}
      </Text>
      {mutation.isError && (
        <Text size="b4" tone="danger" accessibilityLiveRegion="polite">
          {isApiError(mutation.error) ? mutation.error.message : t('todo:toast.retryLater')}
        </Text>
      )}
      <Button
        color="primary"
        isLoading={mutation.isPending}
        onPress={() => {
          if (preview.throughNudgeId !== null)
            mutation.mutate({ todoId, input: { throughNudgeId: preview.throughNudgeId } });
        }}
      >
        {t('todo:interaction.thanksSendCount', { count: preview.totalRecipients })}
      </Button>
    </VStack>
  );
};

NudgeThanksButton.Recipient = function Recipient({
  recipient,
}: {
  recipient: NudgeThanksPreview['recipients'][number];
}) {
  return (
    <HStack align="center" gap={12} py={12}>
      <Avatar alt={recipient.name} className="size-10">
        <Avatar.Image source={getProfileIconSource(recipient.profileImage)} />
      </Avatar>
      <Text size="b3" className="shrink" maxLines={2}>
        {recipient.name}
      </Text>
    </HStack>
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
