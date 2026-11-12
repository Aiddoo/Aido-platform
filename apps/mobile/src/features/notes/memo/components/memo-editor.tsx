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
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
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
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { cn } from '@src/shared/utils/cn';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { Stack, router, useNavigation } from 'expo-router';
import { Menu, Separator, Spinner } from 'heroui-native';
import { type ComponentType, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  type Control,
  Controller,
  type UseFormReturn,
  useForm,
  useFormState,
} from 'react-hook-form';
import { Keyboard } from 'react-native';
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
import { memoFormSchema, type MemoFormValues } from '../schemas/memo-form.schema';
import { createMemoDraftKey } from '../utils/memo-draft';
import { createMemoPlanDraftKey } from '../utils/memo-plan-draft';
import { MEMO_TOOLBAR_ICON } from '../utils/memo-toolbar.view-model';
import { MemoConvertBottomSheet } from './memo-convert-bottom-sheet';

const MEMO_MORE_MENU_WIDTH = 220;

/** 저장한 뒤 이어 갈 일. finish는 저장 버튼, leave는 뒤로 가기, stay는 메뉴(AI 정리·할 일로 바꾸기)다 */
type MemoSaveNextStep = 'finish' | 'leave' | 'stay';

interface MemoEditorToolbarProps {
  control: Control<MemoFormValues>;
  isEditing: boolean;
  canSave: boolean;
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

export function MemoEditor({ toolbar: Toolbar, onLeave }: MemoEditorProps) {
  const navigate = useSingleTap(router.navigate);
  const [memoId] = useMemoId();

  const [{ data: memo }, { data: me }] = useSuspenseQueries({
    queries: [useGetMemoQueryOptions({ memoId }), useGetMeQueryOptions()],
  });

  const { form, canSave, isEditing, setIsEditing, discardDraft } = useMemoForm({
    memo,
    accountId: me.id,
  });
  const saveChanges = useMemoSave({
    memo,
    form,
    canSave,
    discardDraft,
    onFinish: () => setIsEditing(false),
    onLeave,
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
      <Toolbar
        control={form.control}
        isEditing={isEditing}
        canSave={canSave}
        onSave={() => saveChanges({ andThen: 'finish' })}
        onSaveChanges={() => saveChanges({ andThen: 'stay' })}
        onBack={() => saveChanges({ andThen: 'leave' })}
        onConverted={() => {
          onLeave();
          navigate('/feed');
        }}
        onDeleted={() => {
          discardDraft();
          onLeave();
        }}
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
  control,
  isEditing,
  canSave,
  onSave,
  onSaveChanges,
  onBack,
  onConverted,
  onDeleted,
}: MemoEditorToolbarProps) {
  const { t } = useTranslation(['memo', 'common']);
  const [memoId] = useMemoId();

  const [{ data: memo }, { data: me }] = useSuspenseQueries({
    queries: [useGetMemoQueryOptions({ memoId }), useGetMeQueryOptions()],
  });
  const { isSubmitting, isValid } = useFormState({ control });

  const pin = useMemoPinAction(memo);
  const aiParse = useMemoAiParse({ accountId: me.id, onSaveChanges });
  const convertSheet = useOpenMemoConvertSheet({ onSaveChanges, onConverted });
  const openDeleteDialog = useOpenMemoDeleteDialog({ memoId, onDeleted });
  const { label: aiQuota } = useQuotaStatus('AI_PARSE');
  const pinnedTint = useResolvedColor('text-main');
  const saveTint = useResolvedColor(canSave ? 'text-main' : 'text-gray-4');

  const pinLabel = t(pin.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin');
  const aiSubtitle = aiParse.isParsing ? t('memo:detail.aiParsing') : aiQuota;

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
          disabled={!isValid || isSubmitting}
          onPress={onSave}
        >
          {t('common:actions.save')}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu icon={STACK_MORE_ICON} accessibilityLabel={t('memo:detail.more')}>
          <Stack.Toolbar.MenuAction
            icon={MEMO_TOOLBAR_ICON.ai}
            disabled={aiParse.isDisabled}
            {...(aiSubtitle != null && { subtitle: aiSubtitle })}
            onPress={aiParse.start}
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
  control,
  isEditing,
  canSave,
  onSave,
  onSaveChanges,
  onConverted,
  onDeleted,
}: MemoEditorToolbarProps) {
  const [memoId] = useMemoId();

  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions({ memoId }));
  const { isSubmitting, isValid } = useFormState({ control });

  const pin = useMemoPinAction(memo);

  return (
    <Box className="bg-white">
      <HStack align="center" justify="end" gap={4} className="px-2">
        <MemoPinButton isPinned={pin.isPinned} isDisabled={pin.isDisabled} onPress={pin.toggle} />
        {isEditing && (
          <MemoSaveButton
            isHighlighted={canSave}
            isDisabled={!isValid || isSubmitting}
            onPress={onSave}
          />
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
  const goBack = useGoBack({ fallbackHref: '/memo' });

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
function MemoAiParsingBadge() {
  const { t } = useTranslation('memo');
  const [memoId] = useMemoId();
  const isParsing = useIsMutating({ mutationKey: MEMO_MUTATION_KEYS.parse({ memoId }) }) > 0;

  if (!isParsing) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.durationMs.normal)}
      className="self-center pt-3"
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
  const accountId = useSuspenseMyAccountId();

  const [isOpen, setIsOpen] = useState(false);

  const aiParse = useMemoAiParse({ accountId, onSaveChanges });
  const convertSheet = useOpenMemoConvertSheet({ onSaveChanges, onConverted });
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
          isDisabled={aiParse.isDisabled}
          onPress={aiParse.start}
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

/** 입력값·초안·편집 상태를 맡는다. 비교 기준은 서버 원본이고 복원한 초안은 고친 글자다 */
function useMemoForm({ memo, accountId }: { memo: Memo; accountId: string }) {
  const { t } = useTranslation('memo');
  const toast = useAppToast();

  const savedValues = { content: memo.content };
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
    createMemoDraftKey({ userId: accountId, memoId: memo.id }),
    {
      sourceUpdatedAt: toEpochMs(memo.updatedAt),
      onOutdatedDiscard: () => toast.warning(t('toasts.draftOutdated')),
    },
  );
  // 다시 받은 서버 글로 비교 기준을 맞춘다. 고치지 않은 입력은 새 글을 보이고 고치던 글자는 남는다
  const form = useForm({
    resolver: zodResolver(memoFormSchema),
    values: savedValues,
    resetOptions: SERVER_VALUES_RESET_OPTIONS,
  });
  const { isDirty, isValid } = useFormState({ control: form.control });
  const [isEditing, setIsEditing] = useState(restoredDraft != null);

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

  return { form, canSave: isDirty && isValid, isEditing, setIsEditing, discardDraft };
}

interface MemoSaveOptions extends Pick<MemoEditorProps, 'onLeave'> {
  memo: Memo;
  form: UseFormReturn<MemoFormValues>;
  canSave: boolean;
  discardDraft: () => void;
  onFinish: () => void;
}

/** 고친 글자를 저장하고 andThen대로 이어 간다. 저장한 메모를 돌려주고, 저장하지 못하면 null이다 */
function useMemoSave({ memo, form, canSave, discardDraft, onFinish, onLeave }: MemoSaveOptions) {
  const updateMemo = useMutation(useUpdateMemoMutationOptions({ memoId: memo.id }));

  const isSavingChangesRef = useRef(false);

  // 바뀐 글자가 없으면 서버에 보내지 않는다. 수정 시각과 목록 순서가 괜히 바뀌지 않는다
  const saveContent = async (content: string) => {
    if (!MemoPolicy.hasContentChanged(memo, content)) {
      return memo;
    }
    return updateMemo.mutateAsync({ content });
  };

  // 저장 버튼과 뒤로 가기는 handleSubmit으로 보내 저장하는 동안(isSubmitting) 두 버튼을 끈다. 유효하지 않으면 null
  const submitContent = (content: string) =>
    new Promise<Memo | null>((resolve, reject) => {
      form
        .handleSubmit(
          async () => resolve(await saveContent(content)),
          () => resolve(null),
        )()
        .catch(reject);
    });

  return async ({ andThen }: { andThen: MemoSaveNextStep }): Promise<Memo | null> => {
    // 뒤로 가기와 메뉴는 저장할 글자가 없으면 그대로 이어 간다. 저장 버튼은 공백만 고친 글자도 받아 편집을 끝낸다
    if (!canSave && andThen !== 'finish') {
      if (andThen === 'leave') {
        onLeave();
      }
      return memo;
    }
    // 저장마다 수정 시각이 바뀌어 먼저 시작한 AI 정리의 결과가 낡은 것이 된다. 메뉴의 두 번째 저장은 시작하지 않는다
    if (andThen === 'stay') {
      if (isSavingChangesRef.current) {
        return null;
      }
      isSavingChangesRef.current = true;
    }
    const content = form.getValues('content');
    try {
      const savedMemo =
        andThen === 'stay' ? await saveContent(content) : await submitContent(content);
      if (savedMemo == null) {
        return null;
      }
      match(andThen)
        .with('finish', () => {
          form.reset({ content: savedMemo.content }, SAVED_VALUES_RESET_OPTIONS);
          discardDraft();
          onFinish();
          Keyboard.dismiss();
        })
        .with('leave', () => {
          discardDraft();
          onLeave();
        })
        .with('stay', () => {
          // 응답을 기다리는 사이 더 친 글자는 지우지 않는다
          if (form.getValues('content') === content) {
            form.reset({ content: savedMemo.content }, SAVED_VALUES_RESET_OPTIONS);
            discardDraft();
          }
        })
        .exhaustive();

      return savedMemo;
    } catch (error) {
      // 연결 문제로 못 보낸 글자는 초안에 남으니 화면에 가두지 않는다
      if (andThen === 'leave' && isConnectivityError(error)) {
        onLeave();
      }

      return null;
    } finally {
      if (andThen === 'stay') {
        isSavingChangesRef.current = false;
      }
    }
  };
}

/** 헤더가 JS(pane)든 네이티브(Stack 화면)든 같은 고정 동작을 쓴다. */
function useMemoPinAction(memo: Memo) {
  const setPinned = useMutation(useSetMemoPinnedMutationOptions({ memoId: memo.id }));

  return {
    isPinned: memo.isPinned,
    isDisabled: setPinned.isPending,
    toggle: () => setPinned.mutate({ isPinned: !memo.isPinned }),
  };
}

/** 헤더가 JS(pane)든 네이티브(Stack 화면)든 같은 AI 정리 동작을 쓴다. */
function useMemoAiParse({
  accountId,
  onSaveChanges,
}: {
  accountId: string;
} & Pick<MemoEditorToolbarProps, 'onSaveChanges'>) {
  const { t } = useTranslation('errors');
  const haptics = useHaptics();
  const toast = useAppToast();
  const push = useSingleTap(router.push);
  const navigation = useNavigation();
  const draftService = useDraftService();
  const { timeZone } = useDateFormatContext();
  const [memoId] = useMemoId();
  const categoriesQuery = useQuery(useGetTodoCategoriesQueryOptions());
  const entitlementsQuery = useQuery(useGetEntitlementsQueryOptions());
  const parseMemo = useMutation(useParseMemoMutationOptions({ memoId }));
  const isParsing = useIsMutating({ mutationKey: MEMO_MUTATION_KEYS.parse({ memoId }) }) > 0;
  const gate = useEntitlementGate('AI_PARSE', { surface: 'memo_detail' });
  const claimRenewalPrompt = useClaimAiConsentRenewal();
  const aiConsent = useAiDataSharingConsentGate({ claimRenewalPrompt });
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(false);
  const defaultCategoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesQuery.data?.categories ?? [],
    null,
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 저장·정리(최대 30초)를 기다리는 사이 편집기를 떠났으면 지금 보는 화면 위로 끌고 가지 않는다.
  // 받은 결과는 mutation이 초안에 남겨 이 메모에서 다시 누르면 차감 없이 바로 결과 화면으로 간다
  const openReview = () => {
    if (isMountedRef.current && navigation.isFocused()) {
      push({ pathname: '/memo/[memoId]/ai-review', params: { memoId } });
    }
  };

  // 정리 중 서버가 동의 없음(AI_1311)으로 거절했는데 이번 시도에서 동의를 묻지 않았으면 'consentRevoked'다
  // 동의 안내를 이미 본 시도에서 다시 거절되면 안내를 또 띄우지 않고 이유만 알린다
  const showConsentRequired = () => {
    haptics.notify('error');
    toast.error(t(ErrorCode.AI_1311));
  };

  const parseSavedMemo = async (savedMemo: Memo): Promise<'done' | 'consentRevoked'> => {
    const sourceUpdatedAt = toEpochMs(savedMemo.updatedAt);
    // 이미 나눈 결과가 기기에 남아 있으면 다시 부르지 않고(차감 없음) 그대로 보여 준다
    const draft = draftService.restore(
      createMemoPlanDraftKey({ userId: accountId, memoId, timeZone }),
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
    } catch {
      // 오류 안내는 mutation이 맡는다. 동의 없음(AI_1311)만 여기서 동의부터 다시 시작한다
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

  // 정리는 입력칸의 글자가 아니라 저장된 메모로 하므로 고치던 글자를 먼저 저장한다
  const start = async () => {
    // 저장과 동의를 기다리는 동안에는 정리 중 표시가 아직 켜지지 않아 다시 누를 수 있다. 두 번 차감되지 않게 막는다
    if (isStartingRef.current) {
      return;
    }
    isStartingRef.current = true;
    try {
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
    } finally {
      isStartingRef.current = false;
    }
  };

  return {
    start,
    isDisabled: defaultCategoryId == null || entitlementsQuery.isLoading || isParsing,
    isParsing,
  };
}

function useOpenMemoConvertSheet({
  onSaveChanges,
  onConverted,
}: Pick<MemoEditorToolbarProps, 'onSaveChanges' | 'onConverted'>) {
  const todayKey = useTodayKey();
  const openKeyboardSheet = useOpenKeyboardSheet();
  const categoriesQuery = useQuery(useGetTodoCategoriesQueryOptions());
  const defaultCategoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesQuery.data?.categories ?? [],
    null,
  );

  // 옮기기는 입력칸의 글자가 아니라 저장된 메모로 하므로 고치던 글자를 먼저 저장한다
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
        selectedDate={todayKey}
        categoryId={defaultCategoryId}
        isOpen={isOpen}
        onClose={close}
        onOpenChange={onOpenChange}
        onConverted={onConverted}
      />
    ));
  };

  return { open, isDisabled: defaultCategoryId == null };
}
