import { updateMemoSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDraftService, useHaptics } from '@src/bootstrap/providers/di-context';
import { useAiDataSharingConsentGate } from '@src/features/ai/hooks/use-ai-data-sharing-consent-gate';
import { useParseMemoMutationOptions } from '@src/features/ai/queries/use-parse-memo-mutation-options';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useQuotaStatus } from '@src/features/subscription/hooks/use-quota-status';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { AddTodoBottomSheet } from '@src/features/todo/components/add-todo-bottom-sheet';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isApiError, isConnectivityError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  CheckmarkIcon,
  MenuActionItem,
  TrashIcon,
  AiIcon,
  Box,
  ConfirmDialog,
  DocsIcon,
  HStack,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Flex,
  MoreIcon,
  Result,
  STACK_BACK_ICON,
  STACK_MORE_ICON,
  StyledSafeAreaView,
  Text,
  TextArea,
  TextSkeleton,
  useOverlay,
  useStackBackToolbar,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation, useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Menu, Separator, Spinner } from 'heroui-native';
import { Suspense, useLayoutEffect, useState } from 'react';
import { FormProvider, useForm, useFormState } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useResolveClassNames } from 'uniwind';

import type { MemoItem } from '../../domains/memo.model';
import { useMemoScreenParams } from '../../hooks/use-memo-screen-params';
import { useSelectedMemo } from '../../hooks/use-selected-memo';
import { useGetMemoQueryOptions } from '../../queries/get-memo-query-options';
import { useDeleteMemoMutationOptions } from '../../queries/use-delete-memo-mutation-options';
import { useToggleMemoPinMutationOptions } from '../../queries/use-toggle-memo-pin-mutation-options';
import { useUpdateMemoMutationOptions } from '../../queries/use-update-memo-mutation-options';
import { createMemoDraftKey } from '../../utils/memo-draft';
import { createMemoPlanDraftKey } from '../../utils/memo-plan-draft';
import { memoAiReviewHref } from '../../utils/navigation/memo-href';
import {
  MEMO_TOOLBAR_ICON,
  MemoActionButton,
  MemoPinButton,
  MemoSaveButton,
} from './memo-detail-actions';

const MEMO_MORE_MENU_WIDTH = 220;
const MEMO_NOT_FOUND_STATUS = 404;

interface MemoDetailPaneProps {
  /** `screen`은 `/memo/[memoId]` 전체 화면, `pane`은 펼친 메모 탭의 오른쪽 상세 영역이다. */
  presentation: 'screen' | 'pane';
}

/** 메모 식별자는 route의 `id`를 읽는다. 상세 라우트는 pathname, 메모 탭 pane은 같은 이름의 search param이다. */
export function MemoDetailPane({ presentation }: MemoDetailPaneProps) {
  const { memoId } = useMemoScreenParams();

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <QueryErrorBoundary
        resetKeys={[memoId]}
        fallback={(fallbackProps) => (
          <MemoDetailPane.Error {...fallbackProps} presentation={presentation} />
        )}
      >
        <Suspense fallback={<MemoDetailPane.Loading presentation={presentation} />}>
          <MemoDetailContent presentation={presentation} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

/** 받은 뒤에 본문이 밀리지 않게 pane은 버튼 줄 자리를 비워 두고, 첫 줄 시작선은 메모 입력칸과 맞춘다 */
MemoDetailPane.Loading = function Loading({ presentation }: MemoDetailPaneProps) {
  return (
    <VStack flex={1} testID="memo-detail-loading">
      {presentation === 'pane' && (
        <Box className="bg-white">
          <Box className="h-9" />
          <Separator />
        </Box>
      )}
      <VStack gap={8} px={16} py={12}>
        <TextSkeleton size="b2" className="w-full" />
        <TextSkeleton size="b2" className="w-full" />
        <TextSkeleton size="b2" className="w-2/3" />
      </VStack>
    </VStack>
  );
};

/** 서버는 지운 메모와 볼 권한이 없는 메모를 404로 답한다. 전체 화면은 어느 실패든 돌아갈 길을 남긴다 */
MemoDetailPane.Error = function ErrorFallback({
  error,
  reset,
  presentation,
}: QueryErrorFallbackProps & MemoDetailPaneProps) {
  const { t } = useTranslation(['memo', 'common']);
  const backToolbar = useStackBackToolbar({ fallbackHref: '/memo' });
  const goBack = useSingleTap(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/memo');
  });
  const [_selectedMemoId, setSelectedMemoId] = useSelectedMemo();
  const isUnavailable = isApiError(error) && error.status === MEMO_NOT_FOUND_STATUS;

  return (
    <>
      {presentation === 'screen' && backToolbar}
      <Box className="flex-1 px-8">
        {isUnavailable ? (
          <Result
            icon={<DocsIcon width={72} height={72} />}
            title={t('memo:detail.unavailableTitle')}
            description={t('memo:detail.unavailableDescription')}
            button={
              <Result.Button
                onPress={presentation === 'screen' ? goBack : () => setSelectedMemoId(undefined)}
              >
                {t('common:actions.goBack')}
              </Result.Button>
            }
          />
        ) : (
          <Result
            title={t('common:errorBoundary.title')}
            description={t('common:errorBoundary.description')}
            button={<QueryErrorActions onRetry={reset} />}
          />
        )}
      </Box>
    </>
  );
};

MemoDetailPane.Empty = function Empty() {
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

function MemoDetailContent({ presentation }: MemoDetailPaneProps) {
  const { label: aiQuota } = useQuotaStatus('AI_PARSE');
  const haptics = useHaptics();
  const reportUnexpectedError = useReportUnexpectedError('memo');
  const goBack = useSingleTap(router.back);
  const navigate = useSingleTap(router.navigate);

  const { t } = useTranslation(['memo', 'common']);
  const { memoId } = useMemoScreenParams();
  const [_selectedMemoId, setSelectedMemoId] = useSelectedMemo();
  const deselectMemo = useSingleTap(() => setSelectedMemoId(undefined));
  const isPane = presentation === 'pane';
  const leaveMemo = isPane ? deselectMemo : goBack;

  const [{ data: memo }, { data: user }] = useSuspenseQueries({
    queries: [useGetMemoQueryOptions({ memoId }), useGetMeQueryOptions()],
  });
  const toast = useAppToast();

  const savedValues = { content: memo.content };
  const {
    restoredDraft: restoredMemoDraft,
    saveDraft: saveMemoDraft,
    clearDraft: clearMemoDraft,
  } = useDraftStorage(createMemoDraftKey({ userId: user.id, memoId }), {
    sourceUpdatedAt: memo.updatedAt.getTime(),
    onOutdatedDiscard: () => toast.warning(t('memo:toasts.draftOutdated')),
  });
  const formMethods = useForm({
    resolver: zodResolver(updateMemoSchema),
    defaultValues: restoredMemoDraft ?? savedValues,
  });
  const { control, handleSubmit, getValues, reset, subscribe } = formMethods;
  const { isDirty, isValid } = useFormState({ control });
  const discardMemoDraft = useFormDraftAutosave(subscribe, {
    initialValues: savedValues,
    saveDraft: saveMemoDraft,
    clearDraft: clearMemoDraft,
  });

  // 복원한 초안을 입력값으로 둔 채 비교 기준만 서버 원본으로 맞춰 isDirty가 "저장 안 된 변경"을 뜻하게 한다.
  useLayoutEffect(() => {
    if (restoredMemoDraft != null) {
      reset({ content: memo.content }, { keepValues: true });
    }
  }, [memo.content, reset, restoredMemoDraft]);

  const [isEditing, setIsEditing] = useState(restoredMemoDraft != null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { mutateAsync: updateMemo, isPending: isUpdatePending } = useMutation(
    useUpdateMemoMutationOptions(),
  );
  const { mutate: deleteMemo, isPending: isDeletePending } = useMutation(
    useDeleteMemoMutationOptions(),
  );
  const { mutate: togglePin, isPending: isTogglePinPending } = useMutation(
    useToggleMemoPinMutationOptions(),
  );

  const handleSave = handleSubmit(async (formValues) => {
    try {
      const content = formValues.content.trim();
      await updateMemo({ memoId, input: { content } });
      reset({ content });
      discardMemoDraft();
      setIsEditing(false);
      Keyboard.dismiss();
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  const handleBack = async () => {
    if (isDirty && isValid) {
      try {
        await updateMemo({ memoId, input: { content: getValues('content').trim() } });
        discardMemoDraft();
      } catch (error) {
        reportUnexpectedError(error);
        // 연결 문제로 못 보낸 글자는 초안에 남으니 화면에 가두지 않는다
        if (!isConnectivityError(error)) {
          return;
        }
      }
    }
    leaveMemo();
  };

  const handleTogglePin = () => {
    haptics.impact('light');
    togglePin({ memoId, isPinned: !memo.isPinned });
  };

  const aiParse = useAiParseAction({ memo, userId: user.id });
  const convertToTodo = useConvertToTodoAction(() => {
    leaveMemo();
    navigate('/feed');
  });
  const { color: pinnedTint } = useResolveClassNames('text-main');
  const { color: saveTint } = useResolveClassNames(
    isDirty && isValid ? 'text-main' : 'text-gray-4',
  );

  const handleDelete = () => {
    if (isDeletePending) {
      return;
    }

    deleteMemo(memoId, {
      onSuccess: () => {
        discardMemoDraft();
        setIsDeleteDialogOpen(false);
        leaveMemo();
      },
    });
  };

  return (
    <FormProvider {...formMethods}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
        {isPane ? (
          <Box className="bg-white">
            <HStack align="center" justify="end" gap={4} px={8}>
              <MemoPinButton
                isPinned={memo.isPinned}
                isDisabled={isTogglePinPending}
                onPress={handleTogglePin}
              />
              {isEditing && (
                <MemoSaveButton
                  isHighlighted={isDirty && isValid}
                  isDisabled={!isValid || isUpdatePending}
                  onPress={() => handleSave()}
                />
              )}
              <MemoMoreMenu
                aiParse={aiParse}
                convertToTodo={convertToTodo}
                onDelete={() => setIsDeleteDialogOpen(true)}
              />
            </HStack>
            <Separator />
          </Box>
        ) : (
          <>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button
                icon={STACK_BACK_ICON}
                accessibilityLabel={t('common:actions.goBack')}
                disabled={isUpdatePending}
                onPress={handleBack}
              />
            </Stack.Toolbar>
            <Stack.Toolbar placement="right">
              <Stack.Toolbar.Button
                icon={memo.isPinned ? MEMO_TOOLBAR_ICON.pinned : MEMO_TOOLBAR_ICON.pin}
                accessibilityLabel={t(memo.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin')}
                tintColor={memo.isPinned ? pinnedTint : undefined}
                disabled={isTogglePinPending}
                onPress={handleTogglePin}
              >
                {t(memo.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin')}
              </Stack.Toolbar.Button>
              <Stack.Toolbar.Button
                hidden={!isEditing}
                icon={MEMO_TOOLBAR_ICON.save}
                accessibilityLabel={t('common:actions.save')}
                variant="prominent"
                tintColor={saveTint}
                disabled={!isValid || isUpdatePending}
                onPress={() => handleSave()}
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
                <Stack.Toolbar.MenuAction
                  icon={MEMO_TOOLBAR_ICON.delete}
                  destructive
                  onPress={() => setIsDeleteDialogOpen(true)}
                >
                  {t('common:actions.delete')}
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
            </Stack.Toolbar>
          </>
        )}
        <VStack className="flex-1 bg-white">
          {aiParse.isParsing && <MemoAiParsingBadge />}
          <Box className="flex-1" px={16} py={12}>
            <FormField control={control} name="content">
              {({ value, onChange }) => (
                <TextArea
                  variant="bare"
                  preserveErrorSpace={false}
                  value={value}
                  onChange={onChange}
                  onFocus={() => setIsEditing(true)}
                />
              )}
            </FormField>
          </Box>
        </VStack>
      </KeyboardAvoidingView>

      <MemoDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        isPending={isDeletePending}
        onConfirm={handleDelete}
      />
    </FormProvider>
  );
}

interface MemoMoreMenuProps {
  aiParse: Pick<ReturnType<typeof useAiParseAction>, 'handlePress' | 'isDisabled'>;
  convertToTodo: Pick<ReturnType<typeof useConvertToTodoAction>, 'handlePress' | 'isDisabled'>;
  onDelete: () => void;
}

/** 펼친 메모 탭의 ⋯. 항목과 순서는 Stack 화면의 네이티브 메뉴와 같다 */
function MemoMoreMenu({ aiParse, convertToTodo, onDelete }: MemoMoreMenuProps) {
  const { t } = useTranslation(['memo', 'common']);
  const [isOpen, setIsOpen] = useState(false);
  const { label: aiQuota } = useQuotaStatus('AI_PARSE');

  return (
    <Menu isOpen={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger asChild>
        <MemoActionButton
          testID="memo-more"
          accessibilityLabel={t('memo:detail.more')}
          accessibilityState={{ expanded: isOpen }}
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
            icon={AiIcon}
            title={t('memo:detail.aiParse')}
            description={aiQuota}
            isDisabled={aiParse.isDisabled}
            onPress={aiParse.handlePress}
          />
          <MenuActionItem
            testID="memo-convert-to-todo"
            icon={CheckmarkIcon}
            title={t('memo:detail.convertToTodo')}
            isDisabled={convertToTodo.isDisabled}
            onPress={convertToTodo.handlePress}
          />
          <MenuActionItem
            icon={TrashIcon}
            title={t('common:actions.delete')}
            variant="danger"
            onPress={onDelete}
          />
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

/** 메뉴는 누르면 닫혀 진행이 안 보인다. 본문이 밀리지 않게 위에 띄워 알린다 */
function MemoAiParsingBadge() {
  const { t } = useTranslation('memo');

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

interface MemoDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isPending: boolean;
  onConfirm: () => void;
}

function MemoDeleteDialog({ isOpen, onOpenChange, isPending, onConfirm }: MemoDeleteDialogProps) {
  const { t } = useTranslation(['memo', 'common']);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!isPending) {
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
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)} isDisabled={isPending}>
          {t('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton color="danger" onPress={onConfirm} isLoading={isPending}>
          {t('common:actions.delete')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

/** 헤더가 JS(pane)든 네이티브(Stack 화면)든 같은 AI 정리 동작을 쓴다. */
function useAiParseAction({ memo, userId }: { memo: MemoItem; userId: string }) {
  const push = useSingleTap(router.push);
  const draftService = useDraftService();
  const categoriesQuery = useQuery(useGetTodoCategoriesQueryOptions());
  const entitlementsQuery = useQuery(useGetEntitlementsQueryOptions());
  const parseMutation = useMutation(useParseMemoMutationOptions());
  const gate = useEntitlementGate('AI_PARSE', { surface: 'memo_detail' });
  const defaultCategoryId = categoriesQuery.data?.categories[0]?.id;
  const aiConsent = useAiDataSharingConsentGate();
  const toast = useAppToast();
  const { t } = useTranslation('errors');
  const sourceUpdatedAt = memo.updatedAt.getTime();

  const handlePress = async () => {
    // 이미 나눈 결과가 기기에 남아 있으면 다시 부르지 않고(차감 없음) 그대로 보여 준다
    const draft = draftService.restore(createMemoPlanDraftKey({ userId, memoId: memo.id }), {
      sourceUpdatedAt,
    });
    if (draft.status === 'restored') {
      push(memoAiReviewHref(memo.id));
      return;
    }
    if (defaultCategoryId == null || !gate.guard()) {
      return;
    }
    const consent = await aiConsent.ensureAgreed();
    if (!consent.isAgreed) {
      return;
    }

    try {
      await parseMutation.mutateAsync({
        memoId: memo.id,
        content: memo.content,
        categoryId: defaultCategoryId,
        sourceUpdatedAt,
      });
      push(memoAiReviewHref(memo.id));
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
    isDisabled: defaultCategoryId == null || entitlementsQuery.isLoading || parseMutation.isPending,
    isParsing: parseMutation.isPending,
  };
}

function useConvertToTodoAction(onConverted: () => void) {
  const today = useToday();
  const { memoId } = useMemoScreenParams();
  const overlay = useOverlay();
  const { data: memo } = useQuery(useGetMemoQueryOptions({ memoId }));
  const categoriesQuery = useQuery(useGetTodoCategoriesQueryOptions());
  const defaultCategoryId = categoriesQuery.data?.categories[0]?.id;

  const handlePress = () => {
    if (memo == null || defaultCategoryId == null) {
      return;
    }

    overlay.open(({ isOpen, close, exit }) => (
      <AddTodoBottomSheet
        mode="convert-memo"
        memoId={memoId}
        selectedDate={today}
        categoryId={defaultCategoryId}
        initialValues={{ title: memo.content.slice(0, 200) }}
        isOpen={isOpen}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        onSuccess={onConverted}
      />
    ));
  };

  return { handlePress, isDisabled: memo == null || defaultCategoryId == null };
}
