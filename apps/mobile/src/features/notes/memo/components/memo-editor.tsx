import { zodResolver } from '@hookform/resolvers/zod';
import { useDraftService } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useQuotaStatus } from '@src/features/billing/subscription/hooks/use-quota-status';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { ANIMATION } from '@src/shared/constants/animation';
import { toEpochMs } from '@src/shared/date/instant';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isConnectivityError } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  AiIcon,
  Box,
  CheckmarkIcon,
  ConfirmDialog,
  DocsIcon,
  Flex,
  HStack,
  IconButton,
  type IconButtonProps,
  MenuActionItem,
  MoreIcon,
  PinFilledIcon,
  PinIcon,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  STACK_BACK_ICON,
  STACK_MORE_ICON,
  StyledSafeAreaView,
  Text,
  TextArea,
  TextSkeleton,
  TrashIcon,
  useOverlay,
  useStackBackToolbar,
  VStack,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { cn } from '@src/shared/utils/cn';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Menu, Separator, Spinner } from 'heroui-native';
import { type ComponentType, useLayoutEffect, useState } from 'react';
import { type Control, Controller, useForm, useFormState } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { MEMO_MUTATION_KEYS } from '../constants/memo-mutation-keys';
import { MEMO_TOOLBAR_ICON } from '../constants/memo.constants';
import { isMemoUnavailableError } from '../domains/memo.error';
import { useMemoId, useSelectedMemoId } from '../hooks/use-memo-params';
import {
  useDeleteMemoMutationOptions,
  useParseMemoMutationOptions,
  useToggleMemoPinMutationOptions,
  useUpdateMemoMutationOptions,
} from '../queries/memo.mutations';
import { useGetMemoQueryOptions } from '../queries/memo.queries';
import { memoFormSchema, type MemoFormValues } from '../schemas/memo-form.schema';
import { createMemoDraftKey } from '../utils/memo-draft';
import { createMemoPlanDraftKey } from '../utils/memo-plan-draft';
import { MemoConvertBottomSheet } from './memo-convert-bottom-sheet';

const MEMO_MORE_MENU_WIDTH = 220;

interface MemoEditorToolbarProps {
  control: Control<MemoFormValues>;
  isEditing: boolean;
  onSave: () => void;
  onBack: () => void;
  onConverted: () => void;
  onDelete: () => void;
}

interface MemoEditorProps {
  toolbar: ComponentType<MemoEditorToolbarProps>;
  onLeave: () => void;
}

export function MemoEditor({ toolbar: Toolbar, onLeave }: MemoEditorProps) {
  const reportUnexpectedError = useReportUnexpectedError('memo');
  const { t } = useTranslation('memo');
  const toast = useAppToast();
  const navigate = useSingleTap(router.navigate);
  const [memoId] = useMemoId();
  const [{ data: memo }, { data: me }] = useSuspenseQueries({
    queries: [useGetMemoQueryOptions({ memoId }), useGetMeQueryOptions()],
  });
  const savedValues = { content: memo.content };
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
    createMemoDraftKey({ userId: me.id, memoId }),
    {
      sourceUpdatedAt: toEpochMs(memo.updatedAt),
      onOutdatedDiscard: () => toast.warning(t('toasts.draftOutdated')),
    },
  );
  const form = useForm({
    resolver: zodResolver(memoFormSchema),
    defaultValues: restoredDraft ?? savedValues,
  });
  const { isDirty, isValid } = useFormState({ control: form.control });
  const discardDraft = useFormDraftAutosave(form.subscribe, {
    initialValues: savedValues,
    saveDraft,
    clearDraft,
  });
  const [isEditing, setIsEditing] = useState(restoredDraft != null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const updateMemo = useMutation(useUpdateMemoMutationOptions());

  // 복원한 초안을 입력값으로 둔 채 비교 기준만 서버 원본으로 맞춰 isDirty가 "저장 안 된 변경"을 뜻하게 한다.
  useLayoutEffect(() => {
    if (restoredDraft != null) {
      form.reset({ content: memo.content }, { keepValues: true });
    }
  }, [memo.content, form.reset, restoredDraft]);

  // 바뀐 글자가 없으면 서버에 보내지 않는다. 수정 시각과 목록 순서가 괜히 바뀌지 않는다
  const updateChangedContent = async (content: string) => {
    const trimmedContent = content.trim();
    if (trimmedContent !== memo.content) {
      await updateMemo.mutateAsync({ memoId, values: { content: trimmedContent } });
    }
    return trimmedContent;
  };

  const saveAndFinishEditing = form.handleSubmit(async ({ content }) => {
    try {
      const savedContent = await updateChangedContent(content);
      form.reset({ content: savedContent });
      discardDraft();
      setIsEditing(false);
      Keyboard.dismiss();
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  const saveAndLeave = form.handleSubmit(async ({ content }) => {
    try {
      await updateChangedContent(content);
      discardDraft();
    } catch (error) {
      reportUnexpectedError(error);
      // 연결 문제로 못 보낸 글자는 초안에 남으니 화면에 가두지 않는다
      if (!isConnectivityError(error)) {
        return;
      }
    }
    onLeave();
  });

  const handleBack = () => {
    if (isDirty && isValid) {
      saveAndLeave();

      return;
    }
    onLeave();
  };

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
        <Toolbar
          control={form.control}
          isEditing={isEditing}
          onSave={() => saveAndFinishEditing()}
          onBack={handleBack}
          onConverted={() => {
            onLeave();
            navigate('/feed');
          }}
          onDelete={() => setIsDeleteDialogOpen(true)}
        />

        <VStack className="flex-1 bg-white">
          <MemoAiParsingBadge />

          <Box className="flex-1 px-4 py-3">
            <Controller
              control={form.control}
              name="content"
              render={({ field: { value, onChange, ref } }) => (
                <TextArea
                  ref={ref}
                  variant="bare"
                  preserveErrorSpace={false}
                  value={value}
                  onChange={onChange}
                  onFocus={() => setIsEditing(true)}
                />
              )}
            />
          </Box>
        </VStack>
      </KeyboardAvoidingView>

      <MemoDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => {
          discardDraft();
          setIsDeleteDialogOpen(false);
          onLeave();
        }}
      />
    </>
  );
}

MemoEditor.StackToolbar = function StackToolbar({
  control,
  isEditing,
  onSave,
  onBack,
  onConverted,
  onDelete,
}: MemoEditorToolbarProps) {
  const { t } = useTranslation(['memo', 'common']);
  const [memoId] = useMemoId();
  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions({ memoId }));
  const { isDirty, isSubmitting, isValid } = useFormState({ control });
  const togglePin = useMutation(useToggleMemoPinMutationOptions());
  const aiParse = useMemoAiParse();
  const convertToTodo = useMemoConvertToTodo(onConverted);
  const { label: aiQuota } = useQuotaStatus('AI_PARSE');
  const { color: pinnedTint } = useResolveClassNames('text-main');
  const { color: saveTint } = useResolveClassNames(
    isDirty && isValid ? 'text-main' : 'text-gray-4',
  );

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={STACK_BACK_ICON}
          accessibilityLabel={t('common:actions.goBack')}
          disabled={isSubmitting}
          onPress={onBack}
        />
      </Stack.Toolbar>

      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={memo.isPinned ? MEMO_TOOLBAR_ICON.pinned : MEMO_TOOLBAR_ICON.pin}
          accessibilityLabel={t(memo.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin')}
          tintColor={memo.isPinned ? pinnedTint : undefined}
          disabled={togglePin.isPending}
          onPress={() => togglePin.mutate({ memoId, isPinned: !memo.isPinned })}
        >
          {t(memo.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin')}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          hidden={!isEditing}
          icon={MEMO_TOOLBAR_ICON.save}
          accessibilityLabel={t('common:actions.save')}
          variant="prominent"
          tintColor={saveTint}
          disabled={!isValid || isSubmitting}
          onPress={onSave}
        >
          {t('common:actions.save')}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu icon={STACK_MORE_ICON} accessibilityLabel={t('memo:detail.more')}>
          <Stack.Toolbar.MenuAction
            icon={MEMO_TOOLBAR_ICON.ai}
            disabled={aiParse.isDisabled}
            subtitle={aiParse.isParsing ? t('memo:detail.aiParsing') : (aiQuota ?? undefined)}
            onPress={aiParse.handlePress}
          >
            {t('memo:detail.aiParse')}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={MEMO_TOOLBAR_ICON.convertToTodo}
            disabled={convertToTodo.isDisabled}
            onPress={convertToTodo.handlePress}
          >
            {t('memo:detail.convertToTodo')}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon={MEMO_TOOLBAR_ICON.delete} destructive onPress={onDelete}>
            {t('common:actions.delete')}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  );
};

MemoEditor.PaneToolbar = function PaneToolbar({
  control,
  isEditing,
  onSave,
  onConverted,
  onDelete,
}: MemoEditorToolbarProps) {
  const [memoId] = useMemoId();
  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions({ memoId }));
  const { isDirty, isSubmitting, isValid } = useFormState({ control });
  const togglePin = useMutation(useToggleMemoPinMutationOptions());

  return (
    <Box className="bg-white">
      <HStack align="center" justify="end" gap={4} className="px-2">
        <MemoPinButton
          isPinned={memo.isPinned}
          isDisabled={togglePin.isPending}
          onPress={() => togglePin.mutate({ memoId, isPinned: !memo.isPinned })}
        />
        {isEditing && (
          <MemoSaveButton
            isHighlighted={isDirty && isValid}
            isDisabled={!isValid || isSubmitting}
            onPress={onSave}
          />
        )}
        <MemoMoreMenu onConverted={onConverted} onDelete={onDelete} />
      </HStack>

      <Separator />
    </Box>
  );
};

MemoEditor.Loading = function Loading() {
  return (
    <VStack flex={1} testID="memo-detail-loading">
      <MemoContentSkeleton />
    </VStack>
  );
};

/** 받은 뒤에 본문이 밀리지 않게 버튼 줄 자리를 비워 두고, 첫 줄 시작선은 메모 입력칸과 맞춘다 */
MemoEditor.PaneLoading = function PaneLoading() {
  return (
    <VStack flex={1} testID="memo-detail-loading">
      <Box className="bg-white">
        <Box className="h-9" />
        <Separator />
      </Box>
      <MemoContentSkeleton />
    </VStack>
  );
};

/** 서버는 지운 메모와 볼 권한이 없는 메모를 404로 답한다. 전체 화면은 어느 실패든 돌아갈 길을 남긴다 */
MemoEditor.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  const backToolbar = useStackBackToolbar({ fallbackHref: '/memo' });
  const goBack = useSingleTap(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }
    router.replace('/memo');
  });

  return (
    <>
      {backToolbar}
      <MemoUnavailableResult {...props} onLeave={goBack} />
    </>
  );
};

MemoEditor.PaneError = function PaneError(props: QueryErrorFallbackProps) {
  const [_selectedMemoId, setSelectedMemoId] = useSelectedMemoId();

  return <MemoUnavailableResult {...props} onLeave={() => setSelectedMemoId(undefined)} />;
};

MemoEditor.Empty = function Empty() {
  const { t } = useTranslation('memo');

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white px-8">
      <Flex flex={1} justify="center" align="center">
        <Result
          icon={<DocsIcon width={72} height={72} />}
          title={t('detail.emptyTitle')}
          description={t('detail.selectPrompt')}
        />
      </Flex>
    </StyledSafeAreaView>
  );
};

function MemoUnavailableResult({
  error,
  reset,
  onLeave,
}: QueryErrorFallbackProps & { onLeave: () => void }) {
  const { t } = useTranslation(['memo', 'common']);

  return (
    <Box className="flex-1 px-8">
      {match(error)
        .when(isMemoUnavailableError, () => (
          <Result
            icon={<DocsIcon width={72} height={72} />}
            title={t('memo:detail.unavailableTitle')}
            description={t('memo:detail.unavailableDescription')}
            button={<Result.Button onPress={onLeave}>{t('common:actions.goBack')}</Result.Button>}
          />
        ))
        .otherwise(() => (
          <Result
            title={t('common:errorBoundary.title')}
            description={t('common:errorBoundary.description')}
            button={<QueryErrorActions onRetry={reset} />}
          />
        ))}
    </Box>
  );
}

function MemoContentSkeleton() {
  return (
    <VStack gap={8} className="px-4 py-3">
      <TextSkeleton size="b2" className="w-full" />
      <TextSkeleton size="b2" className="w-full" />
      <TextSkeleton size="b2" className="w-2/3" />
    </VStack>
  );
}

/** 메뉴는 누르면 닫혀 진행이 안 보인다. 본문이 밀리지 않게 위에 띄워 알린다 */
function MemoAiParsingBadge() {
  const { t } = useTranslation('memo');
  const [memoId] = useMemoId();
  const isParsing = useIsMutating({ mutationKey: MEMO_MUTATION_KEYS.parse({ memoId }) }) > 0;

  if (!isParsing) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.duration.normal)}
      className="absolute top-3 z-10 self-center"
      pointerEvents="none"
    >
      <HStack gap={8} align="center" className="rounded-full bg-gray-2 px-3 py-2">
        <Spinner size="sm" color="default" />
        <Text size="e1" shade={8}>
          {t('detail.aiParsing')}
        </Text>
      </HStack>
    </Animated.View>
  );
}

type MemoActionProps = Omit<IconButtonProps, 'icon' | 'accessibilityLabel'>;

interface MemoPinButtonProps extends MemoActionProps {
  isPinned: boolean;
}

function MemoPinButton({ isPinned, ...props }: MemoPinButtonProps) {
  const { t } = useTranslation('memo');

  return (
    <IconButton
      accessibilityLabel={t(isPinned ? 'detail.unpin' : 'detail.pin')}
      hitSlop={4}
      className="min-h-9 min-w-9"
      icon={
        isPinned ? (
          <PinFilledIcon width={20} height={20} colorClassName="text-main" />
        ) : (
          <PinIcon width={20} height={20} colorClassName="text-gray-9" />
        )
      }
      {...props}
    />
  );
}

interface MemoSaveButtonProps extends MemoActionProps {
  isHighlighted: boolean;
}

function MemoSaveButton({ isHighlighted, className, ...props }: MemoSaveButtonProps) {
  const { t } = useTranslation('common');

  return (
    <IconButton
      accessibilityLabel={t('actions.save')}
      hitSlop={4}
      className={cn('min-h-9 min-w-9 rounded-full', isHighlighted && 'bg-main', className)}
      icon={
        <CheckmarkIcon
          width={20}
          height={20}
          colorClassName={isHighlighted ? 'text-white dark:text-gray-9' : 'text-gray-5'}
        />
      }
      {...props}
    />
  );
}

/** 펼친 메모 탭의 ⋯. 항목과 순서는 Stack 화면의 네이티브 메뉴와 같다 */
function MemoMoreMenu({
  onConverted,
  onDelete,
}: Pick<MemoEditorToolbarProps, 'onConverted' | 'onDelete'>) {
  const { t } = useTranslation(['memo', 'common']);
  const [isOpen, setIsOpen] = useState(false);
  const aiParse = useMemoAiParse();
  const convertToTodo = useMemoConvertToTodo(onConverted);
  const { label: aiQuota } = useQuotaStatus('AI_PARSE');

  return (
    <Menu isOpen={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger asChild>
        <IconButton
          testID="memo-more"
          accessibilityLabel={t('memo:detail.more')}
          accessibilityState={{ expanded: isOpen }}
          hitSlop={4}
          className="min-h-9 min-w-9"
          icon={<MoreIcon width={20} height={20} colorClassName="text-gray-9" />}
        />
      </Menu.Trigger>
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="end"
          width={MEMO_MORE_MENU_WIDTH}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
          <MenuActionItem
            testID="memo-ai-review"
            Icon={AiIcon}
            title={t('memo:detail.aiParse')}
            description={aiQuota}
            isDisabled={aiParse.isDisabled}
            onPress={aiParse.handlePress}
          />
          <MenuActionItem
            testID="memo-convert-to-todo"
            Icon={CheckmarkIcon}
            title={t('memo:detail.convertToTodo')}
            isDisabled={convertToTodo.isDisabled}
            onPress={convertToTodo.handlePress}
          />
          <MenuActionItem
            Icon={TrashIcon}
            title={t('common:actions.delete')}
            variant="danger"
            onPress={onDelete}
          />
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

interface MemoDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDeleted: () => void;
}

function MemoDeleteDialog({ isOpen, onOpenChange, onDeleted }: MemoDeleteDialogProps) {
  const { t } = useTranslation(['memo', 'common']);
  const [memoId] = useMemoId();
  const deleteMemo = useMutation(useDeleteMemoMutationOptions());

  const handleConfirm = () => {
    if (deleteMemo.isPending) {
      return;
    }
    deleteMemo.mutate(memoId, { onSuccess: onDeleted });
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!deleteMemo.isPending) {
          onOpenChange(open);
        }
      }}
      title={<ConfirmDialog.Title>{t('memo:detail.deleteConfirmTitle')}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>
          {t('memo:detail.deleteConfirmDescription')}
        </ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton
          onPress={() => onOpenChange(false)}
          isDisabled={deleteMemo.isPending}
        >
          {t('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          color="danger"
          onPress={handleConfirm}
          isLoading={deleteMemo.isPending}
        >
          {t('common:actions.delete')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

/** 헤더가 JS(pane)든 네이티브(Stack 화면)든 같은 AI 정리 동작을 쓴다. */
function useMemoAiParse() {
  const { t } = useTranslation('errors');
  const toast = useAppToast();
  const push = useSingleTap(router.push);
  const draftService = useDraftService();
  const { timeZone } = useDateFormatContext();
  const [memoId] = useMemoId();
  const [{ data: memo }, { data: me }] = useSuspenseQueries({
    queries: [useGetMemoQueryOptions({ memoId }), useGetMeQueryOptions()],
  });
  const categoriesQuery = useQuery(useGetTodoCategoriesQueryOptions());
  const entitlementsQuery = useQuery(useGetEntitlementsQueryOptions());
  const parseMemo = useMutation(useParseMemoMutationOptions({ memoId }));
  const isParsing = useIsMutating({ mutationKey: MEMO_MUTATION_KEYS.parse({ memoId }) }) > 0;
  const gate = useEntitlementGate('AI_PARSE', { surface: 'memo_detail' });
  const aiConsent = useAiDataSharingConsentGate();
  const defaultCategoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesQuery.data?.categories ?? [],
    null,
  );
  const sourceUpdatedAt = toEpochMs(memo.updatedAt);

  const handlePress = async () => {
    // 이미 나눈 결과가 기기에 남아 있으면 다시 부르지 않고(차감 없음) 그대로 보여 준다
    const draft = draftService.restore(
      createMemoPlanDraftKey({ userId: me.id, memoId, timeZone }),
      {
        sourceUpdatedAt,
      },
    );
    if (draft.status === 'restored') {
      push({ pathname: '/memo/[memoId]/ai-review', params: { memoId } });

      return;
    }
    if (defaultCategoryId == null || gate.promptIfBlocked()) {
      return;
    }
    const consent = await aiConsent.ensureAgreed();
    if (!consent.isAgreed) {
      return;
    }

    try {
      await parseMemo.mutateAsync({
        content: memo.content,
        categoryId: defaultCategoryId,
        sourceUpdatedAt,
      });
      push({ pathname: '/memo/[memoId]/ai-review', params: { memoId } });

      return;
    } catch {
      // 오류 안내는 mutation이 맡는다. 동의 없음(AI_1311)만 여기서 동의부터 다시 시작한다
    }

    // 정리하는 사이 서버가 동의 없음(AI_1311)으로 거절하면 동의 캐시가 미응답이 된다
    if (!aiConsent.isAgreementRequired()) {
      return;
    }
    // 이번 시도에서 이미 안내했다면 다시 띄우지 않고 이유만 알린다
    if (consent.wasAsked) {
      toast.error(t('AI_1311'));

      return;
    }
    await handlePress();
  };

  return {
    handlePress,
    isDisabled: defaultCategoryId == null || entitlementsQuery.isLoading || isParsing,
    isParsing,
  };
}

function useMemoConvertToTodo(onConverted: () => void) {
  const today = useToday();
  const overlay = useOverlay();
  const [memoId] = useMemoId();
  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions({ memoId }));
  const categoriesQuery = useQuery(useGetTodoCategoriesQueryOptions());
  const defaultCategoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesQuery.data?.categories ?? [],
    null,
  );

  const handlePress = () => {
    if (defaultCategoryId == null) {
      return;
    }

    overlay.open(({ isOpen, close, unmount }) => (
      <MemoConvertBottomSheet
        memo={memo}
        selectedDate={today}
        categoryId={defaultCategoryId}
        isOpen={isOpen}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            unmount();
          }
        }}
        onConverted={onConverted}
      />
    ));
  };

  return { handlePress, isDisabled: defaultCategoryId == null };
}
