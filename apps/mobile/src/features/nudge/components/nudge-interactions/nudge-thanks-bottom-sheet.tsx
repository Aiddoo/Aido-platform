import { ErrorCode } from '@aido/api/errors';
import { FlashList } from '@shopify/flash-list';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { TODO_SHEET_FALLBACK_HREF } from '@src/features/todo/utils/navigation/todo-sheet-href';
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
  useSheetRoute,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Skeleton, Spinner } from 'heroui-native';
import { Suspense, type ComponentProps } from 'react';
import { useWindowDimensions } from 'react-native';
import { match } from 'ts-pattern';

import {
  NudgeInteractionPolicy,
  type NudgeThanksPreview,
} from '../../domains/nudge-interaction.model';
import { useGetNudgeThanksPreviewInfiniteQueryOptions } from '../../queries/get-nudge-thanks-preview-infinite-query-options';
import { useSendNudgeThanksMutationOptions } from '../../queries/use-send-nudge-thanks-mutation-options';

type NudgeThanksBottomSheetProps = Omit<
  ComponentProps<typeof ModalBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange' | 'onExit'
>;

export function NudgeThanksBottomSheet(props: NudgeThanksBottomSheetProps) {
  const { t } = useTranslation('todo');
  const { todoId } = useTodoScreenParams();
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);
  const handleClose = () => sheet.close();

  return (
    <ModalBottomSheet
      {...props}
      isOpen={sheet.isOpen}
      onOpenChange={handleClose}
      onExit={() => sheet.onOpenChange(false)}
    >
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
            <NudgeThanksBottomSheet.Error {...errorProps} onClose={handleClose} />
          )}
        >
          <Suspense fallback={<NudgeThanksBottomSheet.Loading />}>
            <NudgeThanksBottomSheet.Recipients onClose={handleClose} />
          </Suspense>
        </QueryErrorBoundary>
      </VStack>
    </ModalBottomSheet>
  );
}

NudgeThanksBottomSheet.Recipients = function Recipients({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['todo', 'common']);
  const { todoId } = useTodoScreenParams();
  const { height } = useWindowDimensions();
  const thanksPreviewQuery = useSuspenseInfiniteQuery(
    useGetNudgeThanksPreviewInfiniteQueryOptions({ todoId }),
  );
  const sendThanks = useMutation(useSendNudgeThanksMutationOptions());
  const preview = thanksPreviewQuery.data.pages[0];
  const recipients = thanksPreviewQuery.data.pages.flatMap((page) => page.recipients);

  if (sendThanks.isSuccess) {
    return (
      <VStack gap={24} py={16}>
        <HStack align="center" gap={12}>
          <HeartFilledIcon width={28} height={28} colorClassName="text-main" />
          <Text size="b3" weight="semibold" className="shrink">
            {t(
              sendThanks.data > 0
                ? 'todo:interaction.thanksSent'
                : 'todo:interaction.alreadyThanked',
            )}
          </Text>
        </HStack>
        <Button onPress={onClose}>{t('common:actions.done')}</Button>
      </VStack>
    );
  }

  if (preview == null || !NudgeInteractionPolicy.isThankable(preview)) {
    return <NudgeThanksBottomSheet.Empty />;
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
          renderItem={({ item }) => <NudgeThanksBottomSheet.Recipient recipient={item} />}
          ListFooterComponent={match({
            isFetchNextPageError: thanksPreviewQuery.isFetchNextPageError,
            isFetchingNextPage: thanksPreviewQuery.isFetchingNextPage,
          })
            .with({ isFetchNextPageError: true }, () => (
              <Button
                variant="weak"
                size="medium"
                onPress={() => thanksPreviewQuery.fetchNextPage()}
              >
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
            if (
              thanksPreviewQuery.hasNextPage &&
              !thanksPreviewQuery.isFetching &&
              !thanksPreviewQuery.isFetchNextPageError
            ) {
              return thanksPreviewQuery.fetchNextPage({ cancelRefetch: false });
            }
          }}
          onEndReachedThreshold={0.5}
        />
      </Box>
      <Text size="e1" shade={5}>
        {t('todo:interaction.thanksSelectionHint')}
      </Text>
      <Button
        color="primary"
        isLoading={sendThanks.isPending}
        onPress={() => {
          if (preview.throughNudgeId != null) {
            sendThanks.mutate({ todoId, input: { throughNudgeId: preview.throughNudgeId } });
          }
        }}
      >
        {t('todo:interaction.thanksSendCount', { count: preview.totalRecipients })}
      </Button>
    </VStack>
  );
};

NudgeThanksBottomSheet.Recipient = function Recipient({
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

NudgeThanksBottomSheet.Empty = function Empty() {
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

NudgeThanksBottomSheet.Error = function ErrorState({
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

NudgeThanksBottomSheet.Loading = function Loading() {
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
