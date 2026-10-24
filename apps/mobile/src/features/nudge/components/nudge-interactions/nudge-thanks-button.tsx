import { ErrorCode } from '@aido/api/errors';
import { FlashList } from '@shopify/flash-list';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HeartFilledIcon,
  HStack,
  ModalBottomSheet,
  QueryErrorBoundary,
  Result,
  Text,
  TextSkeleton,
  VStack,
  useOverlay,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useMutation, useQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton, Spinner } from 'heroui-native';
import { Suspense, type ComponentProps } from 'react';
import { useWindowDimensions } from 'react-native';
import { match } from 'ts-pattern';

import {
  NudgeInteractionPolicy,
  type NudgeThanksPreview,
} from '../../domains/nudge-interaction.model';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '../../queries/get-nudge-interaction-availability-query-options';
import { useGetNudgeThanksPreviewInfiniteQueryOptions } from '../../queries/get-nudge-thanks-preview-infinite-query-options';
import { useSendNudgeThanksMutationOptions } from '../../queries/use-send-nudge-thanks-mutation-options';

/** 할 일의 감사 시트를 여는 함수를 돌려준다. 시트는 이 훅을 호출한 컴포넌트가 마운트된 동안 유지된다. */
export function useNudgeThanksSheet(todoId: number) {
  const overlay = useOverlay();
  return () =>
    overlay
      .open(({ isOpen, close, exit }) => (
        <NudgeThanksButton.Sheet todoId={todoId} isOpen={isOpen} onClose={close} onExit={exit} />
      ))
      .catch(() => undefined);
}

export function NudgeThanksButton(props: Omit<ComponentProps<typeof Button>, 'children'>) {
  const { t } = useTranslation('todo');
  const availability = useQuery(useGetNudgeInteractionAvailabilityQueryOptions());
  if (!availability.data) {
    return null;
  }

  return (
    <Button {...props} variant={props.variant ?? 'weak'} color={props.color ?? 'primary'}>
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
  const query = useSuspenseInfiniteQuery(useGetNudgeThanksPreviewInfiniteQueryOptions({ todoId }));
  const mutation = useMutation(useSendNudgeThanksMutationOptions());
  const preview = query.data.pages[0];
  const recipients = query.data.pages.flatMap((page) => page.recipients);

  if (mutation.isSuccess) {
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
  }

  if (preview === undefined || !NudgeInteractionPolicy.isThankable(preview)) {
    return <NudgeThanksButton.Empty />;
  }

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
          ListFooterComponent={match({
            isFetchNextPageError: query.isFetchNextPageError,
            isFetchingNextPage: query.isFetchingNextPage,
          })
            .with({ isFetchNextPageError: true }, () => (
              <Button variant="weak" size="medium" onPress={() => query.fetchNextPage()}>
                {t('common:actions.retry')}
              </Button>
            ))
            .with({ isFetchingNextPage: true }, () => (
              <Box py={12}>
                <Spinner />
              </Box>
            ))
            .with({ isFetchNextPageError: false, isFetchingNextPage: false }, () => null)
            .exhaustive()}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
              return query.fetchNextPage({ cancelRefetch: false });
            }
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
          if (preview.throughNudgeId !== null) {
            mutation.mutate({ todoId, input: { throughNudgeId: preview.throughNudgeId } });
          }
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
      <UserAvatar alt={recipient.name} className="size-10" profileImage={recipient.profileImage} />
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
    <VStack gap={20}>
      <TextSkeleton size="b3" className="w-full" />
      <Box style={{ height: 72 }}>
        <HStack align="center" gap={12} py={12}>
          <Skeleton className="size-10 rounded-full" />
          <TextSkeleton size="b3" className="w-24" />
        </HStack>
      </Box>
      <TextSkeleton size="e1" className="w-3/4" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </VStack>
  );
};
