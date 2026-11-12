import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { selectPageItems } from '@src/shared/domains/cursor-page.model';
import { getUserFacingMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HeartFilledIcon,
  HStack,
  InfiniteList,
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
import { clamp } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { Suspense, type ComponentProps } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  NudgeThanksPreviewPolicy,
  type NudgeThanksRecipient,
} from '../domains/nudge-interaction.model';
import { isNudgeUnavailableError } from '../domains/todo-nudge.error';
import { useSendNudgeThanksMutationOptions } from '../queries/todo-nudge.mutations';
import { useGetNudgeThanksPreviewInfiniteQueryOptions } from '../queries/todo-nudge.queries';

const RECIPIENT_ROW_HEIGHT = 64;
const LIST_MIN_HEIGHT = 72;
const LIST_MAX_HEIGHT_RATIO = 0.3;

type NudgeThanksBottomSheetProps = Omit<
  ComponentProps<typeof ModalBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange' | 'onExit'
>;

export function NudgeThanksBottomSheet(props: NudgeThanksBottomSheetProps) {
  const { t } = useTranslation('todo');
  const [todoId] = useTodoId();
  const sheet = useSheetRoute('/feed');
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
          fallback={(fallbackProps) => (
            <NudgeThanksBottomSheet.Error {...fallbackProps} onClose={handleClose} />
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
  const [todoId] = useTodoId();
  const { height } = useWindowDimensions();
  const thanksPreviewQuery = useSuspenseInfiniteQuery(
    useGetNudgeThanksPreviewInfiniteQueryOptions({ todoId }),
  );
  const sendThanks = useMutation(useSendNudgeThanksMutationOptions());
  const preview = thanksPreviewQuery.data.pages[0];
  const recipients = selectPageItems(thanksPreviewQuery.data);

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

  if (preview == null || !NudgeThanksPreviewPolicy.hasThankableRecipients(preview)) {
    return <NudgeThanksBottomSheet.Empty />;
  }

  return (
    <VStack gap={20}>
      <Text size="b3" shade={6}>
        {t('todo:interaction.thanksDescription', { count: preview.totalRecipients })}
      </Text>
      <Box
        style={{
          height: clamp(
            recipients.length * RECIPIENT_ROW_HEIGHT,
            LIST_MIN_HEIGHT,
            height * LIST_MAX_HEIGHT_RATIO,
          ),
        }}
      >
        <InfiniteList
          data={recipients}
          keyExtractor={(recipient) => recipient.id}
          renderItem={({ item }) => <NudgeThanksBottomSheet.Recipient recipient={item} />}
          hasNextPage={thanksPreviewQuery.hasNextPage}
          isFetchingNextPage={thanksPreviewQuery.isFetchingNextPage}
          isFetchNextPageError={thanksPreviewQuery.isFetchNextPageError}
          fetchNextPage={thanksPreviewQuery.fetchNextPage}
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
  recipient: NudgeThanksRecipient;
}) {
  return (
    <HStack align="center" gap={12} py={12}>
      <UserAvatar alt={recipient.name} className="size-10" profileImage={recipient.profileImage} />
      <Text size="b3" className="shrink" numberOfLines={2}>
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

NudgeThanksBottomSheet.Error = function ErrorFallback({
  error,
  reset,
  onClose,
}: QueryErrorFallbackProps & { onClose: () => void }) {
  const { t } = useTranslation(['todo', 'common']);
  const isUnavailable = isNudgeUnavailableError(error);

  return (
    <VStack py={24}>
      <Result
        title={
          (isUnavailable ? getUserFacingMessage(error) : undefined) ??
          t('todo:interaction.thanksLoadError')
        }
        button={
          <Result.Button onPress={isUnavailable ? onClose : reset}>
            {t(isUnavailable ? 'common:actions.close' : 'common:actions.retry')}
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
      <Box style={{ height: LIST_MIN_HEIGHT }}>
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
