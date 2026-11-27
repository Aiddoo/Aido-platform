import { ErrorCode } from '@aido/api/errors';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDraftService, useHaptics } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useQuotaStatus } from '@src/features/billing/subscription/hooks/use-quota-status';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useClaimAiConsentRenewal } from '@src/features/device/coachmark/hooks/use-claim-ai-consent-renewal';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { ANIMATION } from '@src/shared/constants/animation';
import {
  SAVED_VALUES_RESET_OPTIONS,
  SERVER_VALUES_RESET_OPTIONS,
} from '@src/shared/constants/server-values-reset-options';
import { toEpochMs } from '@src/shared/date/instant';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isConnectivityError } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useDismissKeyboard } from '@src/shared/hooks/use-dismiss-keyboard';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useIsUnmountedRef } from '@src/shared/hooks/use-is-unmounted-ref';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Box,
  CheckmarkIcon,
  HStack,
  IconButton,
  type IconButtonProps,
  MemoIllustration,
  MenuActionItem,
  MoreIcon,
  PinFilledIcon,
  PinIcon,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  STACK_BACK_ICON,
  STACK_MORE_ICON,
  Text,
  TextArea,
  TextSkeleton,
  TrashIcon,
  useOpenKeyboardSheet,
  useStackBackToolbar,
  VStack,
  MenuContent,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { Menu, Separator, Spinner } from 'heroui-native';
import { type ComponentProps, type ComponentType, useLayoutEffect, useRef, useState } from 'react';
import { Controller, FormState, useForm } from 'react-hook-form';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { isMemoUnavailableError } from '../domains/memo.error';
import { type Memo, MemoPolicy } from '../domains/memo.model';
import { useMemoId, useSelectedMemoId } from '../hooks/use-memo-params';
import { useOpenMemoDeleteDialog } from '../hooks/use-open-memo-delete-dialog';
import { MEMO_MUTATION_KEYS } from '../queries/memo-mutation-keys';
import {
  useParseMemoMutationOptions,
  useSetMemoPinnedMutationOptions,
  useUpdateMemoMutationOptions,
} from '../queries/memo.mutations';
import { useGetMemoQueryOptions } from '../queries/memo.queries';
import { memoFormSchema } from '../schemas/memo-form.schema';
import { createMemoDraftKey } from '../utils/memo-draft';
import { createMemoPlanDraftKey } from '../utils/memo-plan-draft';
import { MEMO_TOOLBAR_ICON } from '../utils/memo-toolbar.view-model';
import { MemoConvertBottomSheet } from './memo-convert-bottom-sheet';

const MEMO_MORE_MENU_WIDTH = 220;

interface MemoEditorToolbarProps {
  isEditing: boolean;
  canSave: boolean;
  isSubmitting: boolean;
  isSaveDisabled: boolean;
  onSave: () => void;
  /** 저장하지 않은 변경이 있으면 먼저 저장하고, 저장한 메모를 돌려준다. 저장에 실패하면 null */
  onSaveChanges: () => Promise<Memo | null>;
  onBack: () => void;
  onConverted: () => void;
  onDeleted: () => void;
}

interface MemoEditorProps {
  toolbar: ComponentType<MemoEditorToolbarProps>;
  onLeave: () => void;
}

/** 입력값·초안·편집 상태와 저장을 맡는다. 비교 기준은 서버 원본이고 복원한 초안은 고친 글자다 */
export function MemoEditor({ toolbar: Toolbar, onLeave }: MemoEditorProps) {
  const { t } = useTranslation('memo');
  const toast = useAppToast();
  const router = useRouter();
  const navigate = useSingleTap(router.navigate);
  const dismissKeyboard = useDismissKeyboard();
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
  const [isEditing, setIsEditing] = useState(restoredDraft != null);
  const isSavingChangesRef = useRef(false);

  const updateMemo = useMutation(useUpdateMemoMutationOptions({ memoId }));
  // 다시 받은 서버 글로 비교 기준을 맞춘다. 고치지 않은 입력은 새 글을 보이고 고치던 글자는 남는다
  const form = useForm({
    resolver: zodResolver(memoFormSchema),
    values: savedValues,
    resetOptions: SERVER_VALUES_RESET_OPTIONS,
  });
  const discardDraft = useFormDraftAutosave(form.subscribe, {
    initialValues: savedValues,
    saveDraft,
    clearDraft,
  });

  // 복원한 초안은 그리기 전에 고친 글자로 넣어 isDirty가 "저장 안 된 변경"을 뜻하게 한다
  useLayoutEffect(() => {
    if (restoredDraft != null) {
      form.setValue('content', restoredDraft.content, { shouldDirty: true });
    }
  }, [form, restoredDraft]);

  // 바뀐 글자가 없으면 서버에 보내지 않는다. 수정 시각과 목록 순서가 괜히 바뀌지 않는다
  const saveContent = async (content: string) => {
    if (!MemoPolicy.hasContentChanged(memo, content)) {
      return memo;
    }
    return updateMemo.mutateAsync({ content });
  };

  // 저장 버튼은 공백만 고친 글자도 받아 편집을 끝낸다
  const submitMemo = form.handleSubmit(async () => {
    const savedMemo = await saveContent(form.getValues('content'));
    form.reset({ content: savedMemo.content }, SAVED_VALUES_RESET_OPTIONS);
    discardDraft();
    setIsEditing(false);
    dismissKeyboard();
  });

  const submitMemoAndLeave = form.handleSubmit(async () => {
    const savedMemo = await saveContent(form.getValues('content'));
    // 앞뒤 공백을 다듬어 저장된 글로 맞춘다. 맞추지 않으면 공백만 다른 글이 초안으로 다시 쓰여 다음에 저장 안 된 변경처럼 열린다
    form.reset({ content: savedMemo.content }, SAVED_VALUES_RESET_OPTIONS);
    discardDraft();
    onLeave();
  });

  // 지웠거나 이미 없는 메모는 다시 보내도 소용없어 초안을 버리고 떠난다. 이미 없다는 안내는 mutation이 한다
  const discardDraftAndLeave = () => {
    discardDraft();
    onLeave();
  };

  // isSubmitting은 다음 렌더에야 켜져 같은 프레임의 두 번째 탭이 한 번 더 보낸다
  const handleSavePress = useSingleTap(() => {
    // 실패 안내는 mutation의 meta.errorFeedback이 맡고 글자와 편집 상태는 그대로 둔다
    submitMemo().catch((error: unknown) => {
      if (isMemoUnavailableError(error)) {
        discardDraftAndLeave();
      }
    });
  });

  const handleBackPress = useSingleTap(({ canSave }: { canSave: boolean }) => {
    if (!canSave) {
      onLeave();
      return;
    }
    submitMemoAndLeave().catch((error: unknown) => {
      if (isMemoUnavailableError(error)) {
        discardDraftAndLeave();
        return;
      }
      // 연결 문제로 못 보낸 글자는 초안에 남으니 화면에 가두지 않는다
      if (isConnectivityError(error)) {
        onLeave();
      }
    });
  });

  // 메뉴(AI 정리·할 일로 바꾸기)는 입력칸의 글자가 아니라 저장된 메모로 하므로 고치던 글자를 먼저 저장한다
  const saveChanges = async ({ canSave }: { canSave: boolean }): Promise<Memo | null> => {
    if (!canSave) {
      return memo;
    }
    // 저장마다 수정 시각이 바뀌어 앞선 AI 정리 결과가 낡는다. isPending은 다음 렌더에야 켜져 두 번째 누름을 못 막는다
    if (isSavingChangesRef.current) {
      return null;
    }
    isSavingChangesRef.current = true;
    const content = form.getValues('content');
    const savedMemo = await saveContent(content).catch((error: unknown) => {
      if (isMemoUnavailableError(error)) {
        discardDraftAndLeave();
      }
      return null;
    });
    isSavingChangesRef.current = false;
    // 응답을 기다리는 사이 더 친 글자는 지우지 않는다
    if (savedMemo != null && form.getValues('content') === content) {
      form.reset({ content: savedMemo.content }, SAVED_VALUES_RESET_OPTIONS);
      discardDraft();
    }
    return savedMemo;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
      <FormState
        control={form.control}
        render={({ isDirty, isValid, isSubmitting }) => {
          const canSave = isDirty && isValid;

          return (
            <Toolbar
              isEditing={isEditing}
              canSave={canSave}
              isSubmitting={isSubmitting}
              isSaveDisabled={!isValid || isSubmitting}
              onSave={handleSavePress}
              onSaveChanges={() => saveChanges({ canSave })}
              onBack={() => handleBackPress({ canSave })}
              onConverted={() => {
                onLeave();
                navigate('/feed');
              }}
              onDeleted={discardDraftAndLeave}
            />
          );
        }}
      />

      <VStack className="flex-1 bg-white">
        <MemoAiParsingBadge className="self-center pt-3" />

        <Box className="flex-1 px-4 py-3">
          <Controller
            control={form.control}
            name="content"
            render={({ field: { value, onChange, ref } }) => (
              <TextArea
                ref={ref}
                variant="bare"
                shouldPreserveErrorSpace={false}
                value={value}
                onChange={onChange}
                onFocus={() => setIsEditing(true)}
                testID="memo-editor-input"
              />
            )}
          />
        </Box>
      </VStack>
    </KeyboardAvoidingView>
  );
}

MemoEditor.StackToolbar = function StackToolbar({
  isEditing,
  canSave,
  isSubmitting,
  isSaveDisabled,
  onSave,
  onSaveChanges,
  onBack,
  onConverted,
  onDeleted,
}: MemoEditorToolbarProps) {
  const { t } = useTranslation(['memo', 'common']);
  const [memoId] = useMemoId();

  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions({ memoId }));

  const pin = useMemoPinAction({ memo, onUnavailable: onDeleted });
  const startAiParse = useSuspenseStartMemoAiParse({ onSaveChanges });
  const isAiParseDisabled = useIsMemoAiParseDisabled();
  const isParsing = useIsMemoParsing();
  const convertSheet = useOpenMemoConvertSheet({ onSaveChanges, onConverted, onDeleted });
  const openDeleteDialog = useOpenMemoDeleteDialog({ memoId, onDeleted });
  const { label: aiQuota } = useQuotaStatus('AI_PARSE');
  const pinnedTint = useResolvedColor('text-main');
  const saveTint = useResolvedColor(canSave ? 'text-main' : 'text-gray-4');

  const pinLabel = t(pin.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin');
  const aiSubtitle = isParsing ? t('memo:detail.aiParsing') : aiQuota;

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
          icon={pin.isPinned ? MEMO_TOOLBAR_ICON.pinned : MEMO_TOOLBAR_ICON.pin}
          accessibilityLabel={pinLabel}
          tintColor={pin.isPinned ? pinnedTint : undefined}
          disabled={pin.isDisabled}
          onPress={pin.toggle}
        >
          {pinLabel}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          hidden={!isEditing}
          icon={MEMO_TOOLBAR_ICON.save}
          accessibilityLabel={t('common:actions.save')}
          variant="prominent"
          tintColor={saveTint}
          disabled={isSaveDisabled}
          onPress={onSave}
        >
          {t('common:actions.save')}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu icon={STACK_MORE_ICON} accessibilityLabel={t('memo:detail.more')}>
          <Stack.Toolbar.MenuAction
            icon={MEMO_TOOLBAR_ICON.ai}
            disabled={isAiParseDisabled}
            {...(aiSubtitle != null && { subtitle: aiSubtitle })}
            onPress={startAiParse}
          >
            {t('memo:detail.aiParse')}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={MEMO_TOOLBAR_ICON.convertToTodo}
            disabled={convertSheet.isDisabled}
            onPress={convertSheet.open}
          >
            {t('memo:detail.convertToTodo')}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={MEMO_TOOLBAR_ICON.delete}
            destructive
            onPress={openDeleteDialog}
          >
            {t('common:actions.delete')}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  );
};

MemoEditor.PaneToolbar = function PaneToolbar({
  isEditing,
  canSave,
  isSaveDisabled,
  onSave,
  onSaveChanges,
  onConverted,
  onDeleted,
}: MemoEditorToolbarProps) {
  const [memoId] = useMemoId();

  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions({ memoId }));

  const pin = useMemoPinAction({ memo, onUnavailable: onDeleted });

  return (
    <Box className="bg-white">
      <HStack align="center" justify="end" gap={4} className="px-2">
        <MemoPinButton isPinned={pin.isPinned} isDisabled={pin.isDisabled} onPress={pin.toggle} />
        {isEditing && (
          <MemoSaveButton isHighlighted={canSave} isDisabled={isSaveDisabled} onPress={onSave} />
        )}
        <MemoMoreMenu
          onSaveChanges={onSaveChanges}
          onConverted={onConverted}
          onDeleted={onDeleted}
        />
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

/** 서버는 지운 메모와 볼 권한이 없는 메모를 404로 답한다. 전체 화면은 어느 실패든 돌아갈 길을 남긴다 */
MemoEditor.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  const backToolbar = useStackBackToolbar({ fallbackHref: '/memo' });
  const goBack = useGoBack({ fallbackHref: '/memo' });

  return (
    <>
      {backToolbar}
      <MemoUnavailableResult {...props} onLeave={goBack} />
    </>
  );
};

/** 펼친 메모 탭의 옆 칸 편집기. 떠나면 화면을 닫지 않고 고른 메모만 푼다 */
export function MemoPaneEditor() {
  const [_selectedMemoId, setSelectedMemoId] = useSelectedMemoId();
  const deselectMemo = useSingleTap(() => setSelectedMemoId(undefined));

  return <MemoEditor toolbar={MemoEditor.PaneToolbar} onLeave={deselectMemo} />;
}

/** 받은 뒤에 본문이 밀리지 않게 버튼 줄 자리를 비워 두고, 첫 줄 시작선은 메모 입력칸과 맞춘다 */
MemoPaneEditor.Loading = function Loading() {
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

MemoPaneEditor.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  const [_selectedMemoId, setSelectedMemoId] = useSelectedMemoId();

  return <MemoUnavailableResult {...props} onLeave={() => setSelectedMemoId(undefined)} />;
};

MemoPaneEditor.Empty = function Empty() {
  const { t } = useTranslation('memo');

  return (
    <Box flex={1} className="px-8">
      <Result
        icon={<MemoIllustration />}
        title={t('detail.emptyTitle')}
        description={t('detail.selectPrompt')}
      />
    </Box>
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
            icon={<MemoIllustration />}
            title={t('memo:detail.unavailableTitle')}
            description={t('memo:detail.unavailableDescription')}
            button={<Result.Button onPress={onLeave}>{t('common:actions.goBack')}</Result.Button>}
          />
        ))
        .otherwise(() => (
          <QueryErrorFallback reset={reset} />
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

/** 메뉴는 누르면 닫혀 진행이 안 보인다. 본문 위 줄에 알린다. 본문 위에 띄우면 첫 줄을 가린다 */
function MemoAiParsingBadge({
  className,
}: Pick<ComponentProps<typeof Animated.View>, 'className'>) {
  const { t } = useTranslation('memo');
  const isParsing = useIsMemoParsing();

  if (!isParsing) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.durationMs.normal)}
      className={className}
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
  const fontScaledSize = useFontScaledSize();

  return (
    <IconButton
      accessibilityLabel={t(isPinned ? 'detail.unpin' : 'detail.pin')}
      hitSlop={4}
      className="min-h-9 min-w-9"
      icon={
        isPinned ? (
          <PinFilledIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-main"
          />
        ) : (
          <PinIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-gray-9"
          />
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
  const fontScaledSize = useFontScaledSize();

  return (
    <IconButton
      accessibilityLabel={t('actions.save')}
      hitSlop={4}
      className={cn('min-h-9 min-w-9 rounded-full', isHighlighted && 'bg-main', className)}
      icon={
        <CheckmarkIcon
          width={fontScaledSize(20)}
          height={fontScaledSize(20)}
          colorClassName={cn('text-gray-5', isHighlighted && 'text-white dark:text-gray-9')}
        />
      }
      {...props}
    />
  );
}

/** 펼친 메모 탭의 ⋯. 항목과 순서는 Stack 화면의 네이티브 메뉴와 같다 */
function MemoMoreMenu({
  onSaveChanges,
  onConverted,
  onDeleted,
}: Pick<MemoEditorToolbarProps, 'onSaveChanges' | 'onConverted' | 'onDeleted'>) {
  const { t } = useTranslation(['memo', 'common']);
  const fontScaledSize = useFontScaledSize();

  const [memoId] = useMemoId();

  const [isOpen, setIsOpen] = useState(false);

  const startAiParse = useSuspenseStartMemoAiParse({ onSaveChanges });
  const isAiParseDisabled = useIsMemoAiParseDisabled();
  const convertSheet = useOpenMemoConvertSheet({ onSaveChanges, onConverted, onDeleted });
  const openDeleteDialog = useOpenMemoDeleteDialog({ memoId, onDeleted });
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
          icon={
            <MoreIcon
              width={fontScaledSize(20)}
              height={fontScaledSize(20)}
              colorClassName="text-gray-9"
            />
          }
        />
      </Menu.Trigger>
      <MenuContent width={MEMO_MORE_MENU_WIDTH}>
        <MenuActionItem
          testID="memo-ai-review"
          Icon={AiFilledIcon}
          title={t('memo:detail.aiParse')}
          description={aiQuota}
          isDisabled={isAiParseDisabled}
          onPress={startAiParse}
        />
        <MenuActionItem
          testID="memo-convert-to-todo"
          Icon={CheckmarkIcon}
          title={t('memo:detail.convertToTodo')}
          isDisabled={convertSheet.isDisabled}
          onPress={convertSheet.open}
        />
        <MenuActionItem
          Icon={TrashIcon}
          title={t('common:actions.delete')}
          variant="danger"
          onPress={openDeleteDialog}
        />
      </MenuContent>
    </Menu>
  );
}

/** 헤더가 JS(pane)든 네이티브(Stack 화면)든 같은 고정 동작을 쓴다. */
function useMemoPinAction({ memo, onUnavailable }: { memo: Memo; onUnavailable: () => void }) {
  const setPinned = useMutation(useSetMemoPinnedMutationOptions({ memoId: memo.id }));

  return {
    isPinned: memo.isPinned,
    isDisabled: setPinned.isPending,
    toggle: () =>
      setPinned.mutate(
        { isPinned: !memo.isPinned },
        {
          onError: (error) => {
            if (isMemoUnavailableError(error)) {
              onUnavailable();
            }
          },
        },
      ),
  };
}

function useIsMemoParsing() {
  const [memoId] = useMemoId();

  return useIsMutating({ mutationKey: MEMO_MUTATION_KEYS.parse({ memoId }) }) > 0;
}

/** 할 일로 옮길 때 처음 고르는 카테고리. 카테고리를 받기 전이면 null이다 */
function useMemoDefaultCategoryId() {
  const { data: categoriesResult } = useQuery(useGetTodoCategoriesQueryOptions());

  return TodoCategoryPolicy.findInitialCategoryId(categoriesResult?.categories, null);
}

function useIsMemoAiParseDisabled() {
  const defaultCategoryId = useMemoDefaultCategoryId();
  const { isLoading: isEntitlementsLoading } = useQuery(useGetEntitlementsQueryOptions());
  const isParsing = useIsMemoParsing();

  return defaultCategoryId == null || isEntitlementsLoading || isParsing;
}

/** 저장·정리(최대 30초)를 기다리는 사이 편집기를 떠났으면 지금 보는 화면 위로 끌고 가지 않는다 */
function useOpenMemoPlanReview() {
  const router = useRouter();
  const push = useSingleTap(router.push);
  const navigation = useNavigation();
  const [memoId] = useMemoId();
  const isUnmountedRef = useIsUnmountedRef();

  return () => {
    if (!isUnmountedRef.current && navigation.isFocused()) {
      push({ pathname: '/memo/[memoId]/ai-review', params: { memoId } });
    }
  };
}

/** 헤더가 JS(pane)든 네이티브(Stack 화면)든 같은 AI 정리 시작을 쓴다. 정리는 저장된 메모로 하므로 고치던 글자를 먼저 저장한다 */
function useSuspenseStartMemoAiParse({
  onSaveChanges,
}: Pick<MemoEditorToolbarProps, 'onSaveChanges'>) {
  const { t } = useTranslation('errors');
  const haptics = useHaptics();
  const toast = useAppToast();
  const draftService = useDraftService();
  const { timezone } = useDateFormatContext();
  const [memoId] = useMemoId();
  const accountId = useSuspenseMyAccountId();
  const defaultCategoryId = useMemoDefaultCategoryId();
  const parseMemo = useMutation(useParseMemoMutationOptions({ memoId }));
  const gate = useEntitlementGate('AI_PARSE', { surface: 'memo_detail' });
  const claimRenewalPrompt = useClaimAiConsentRenewal();
  const aiConsent = useAiDataSharingConsentGate({ claimRenewalPrompt });
  const openReview = useOpenMemoPlanReview();
  const isStartingRef = useRef(false);

  // 정리 중 서버가 동의 없음(AI_1311)으로 거절했는데 이번 시도에서 동의를 묻지 않았으면 'consentRevoked'다
  const showConsentRequired = () => {
    haptics.notify('error');
    toast.error(t(ErrorCode.AI_1311));
  };

  const parseSavedMemo = async (savedMemo: Memo): Promise<'done' | 'consentRevoked'> => {
    const sourceUpdatedAt = toEpochMs(savedMemo.updatedAt);
    // 이미 나눈 결과가 기기에 남아 있으면 다시 부르지 않고(차감 없음) 그대로 보여 준다
    const draft = draftService.restore(
      createMemoPlanDraftKey({ userId: accountId, memoId, timezone }),
      {
        sourceUpdatedAt,
      },
    );
    if (draft.status === 'restored') {
      openReview();

      return 'done';
    }
    if (defaultCategoryId == null || gate.promptIfBlocked()) {
      return 'done';
    }
    const consent = await aiConsent.requestAgreementIfNeeded();
    if (!consent.hasAgreed) {
      return 'done';
    }

    try {
      await parseMemo.mutateAsync({
        content: savedMemo.content,
        categoryId: defaultCategoryId,
        sourceUpdatedAt,
      });
      openReview();

      return 'done';
    } catch (error) {
      // 한도 안내만 여기서 띄운다. 다른 오류 안내는 mutation이 맡고, 동의 없음(AI_1311)은 아래에서 동의부터 다시 시작한다
      if (gate.promptIfBlockedError(error)) {
        haptics.notify('error');
      }
    }

    // 정리하는 사이 서버가 동의 없음(AI_1311)으로 거절하면 동의 캐시가 미응답이 된다
    if (!aiConsent.isConsentRequired()) {
      return 'done';
    }
    // 이번 시도에서 이미 안내했다면 다시 띄우지 않고 이유만 알린다
    if (consent.wasAsked) {
      showConsentRequired();

      return 'done';
    }
    return 'consentRevoked';
  };

  const startParse = async () => {
    const savedMemo = await onSaveChanges();
    if (savedMemo == null) {
      return;
    }
    if ((await parseSavedMemo(savedMemo)) === 'done') {
      return;
    }
    // 정리하다 동의가 사라진 것을 알았으면 동의를 물으며 한 번만 다시 시작한다. 그래도 거절되면 이유만 알린다
    if ((await parseSavedMemo(savedMemo)) === 'consentRevoked') {
      showConsentRequired();
    }
  };

  return () => {
    // 저장과 동의를 기다리는 동안에는 정리 중 표시가 아직 켜지지 않아 다시 누를 수 있다. 두 번 차감되지 않게 막는다
    if (isStartingRef.current) {
      return Promise.resolve();
    }
    isStartingRef.current = true;
    return startParse().finally(() => {
      isStartingRef.current = false;
    });
  };
}

function useOpenMemoConvertSheet({
  onSaveChanges,
  onConverted,
  onDeleted,
}: Pick<MemoEditorToolbarProps, 'onSaveChanges' | 'onConverted' | 'onDeleted'>) {
  const openKeyboardSheet = useOpenKeyboardSheet();
  const defaultCategoryId = useMemoDefaultCategoryId();

  const open = async () => {
    if (defaultCategoryId == null) {
      return;
    }
    const savedMemo = await onSaveChanges();
    if (savedMemo == null) {
      return;
    }

    openKeyboardSheet(({ isOpen, onOpenChange, close }) => (
      <MemoConvertBottomSheet
        memo={savedMemo}
        isOpen={isOpen}
        onClose={close}
        onOpenChange={onOpenChange}
        onConverted={onConverted}
        // 이미 없는 메모는 지운 메모처럼 초안을 버리고 떠난다
        onUnavailable={onDeleted}
      />
    ));
  };

  return { open, isDisabled: defaultCategoryId == null };
}
