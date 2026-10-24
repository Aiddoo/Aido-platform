import { updateMemoSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { getParsedMemo } from '@src/features/ai/queries/ai-cache';
import { useGetAiUsageQueryOptions } from '@src/features/ai/queries/get-ai-usage-query-options';
import { AddTodoBottomSheet } from '@src/features/todo/components/add-todo-bottom-sheet';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isBusinessError } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ConfirmDialog,
  DocsIcon,
  HStack,
  QueryErrorBoundary,
  Result,
  RobotIcon,
  CheckboxIcon,
  StyledSafeAreaView,
  TextArea,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { impactFeedback } from '@src/shared/utils/haptics';
import { useMutation, useQuery, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Stack, router } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense, useLayoutEffect, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useForm, useFormState } from 'react-hook-form';
import { ActivityIndicator, Keyboard } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { useMemoScreenParams } from '../../hooks/use-memo-screen-params';
import { useSelectedMemo } from '../../hooks/use-selected-memo';
import { useGetMemoQueryOptions } from '../../queries/get-memo-query-options';
import { useDeleteMemoMutationOptions } from '../../queries/use-delete-memo-mutation-options';
import { useToggleMemoPinMutationOptions } from '../../queries/use-toggle-memo-pin-mutation-options';
import { useUpdateMemoMutationOptions } from '../../queries/use-update-memo-mutation-options';
import { createMemoDraftKey } from '../../utils/memo-draft';
import { memoAiReviewHref } from '../../utils/navigation/memo-href';
import { AiParseConfirmDialog } from '../ai-parse-confirm-dialog';
import {
  MemoActionButton,
  MemoDeleteButton,
  MemoBackButton,
  MemoPinButton,
  MemoSaveButton,
} from './memo-detail-actions';

interface MemoDetailPaneProps {
  /** `screen`은 `/memo/[memoId]` 전체 화면, `pane`은 펼친 메모 탭의 오른쪽 상세 영역이다. */
  presentation: 'screen' | 'pane';
}

/** 메모 식별자는 route의 `id`를 읽는다. 상세 라우트는 pathname, 메모 탭 pane은 같은 이름의 search param이다. */
export function MemoDetailPane({ presentation }: MemoDetailPaneProps) {
  const { memoId } = useMemoScreenParams();

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[memoId]}>
        <Suspense fallback={<ActivityIndicator className="flex-1" />}>
          <MemoDetailContent presentation={presentation} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

MemoDetailPane.Empty = function Empty() {
  const { t } = useTranslation('memo');

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white px-8">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('detail.emptyTitle')}
        description={t('detail.selectPrompt')}
      />
    </StyledSafeAreaView>
  );
};

function MemoDetailContent({ presentation }: MemoDetailPaneProps) {
  const { showBoundary } = useErrorBoundary();
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
  const { isDirty, isValid, isSubmitting } = useFormState({ control });
  const discardMemoDraft = useFormDraftAutosave(subscribe, {
    initialValues: savedValues,
    saveDraft: saveMemoDraft,
    clearDraft: clearMemoDraft,
  });

  // 복원한 초안을 입력값으로 둔 채 비교 기준만 서버 원본으로 맞춰 isDirty가 "저장 안 된 변경"을 뜻하게 한다.
  useLayoutEffect(() => {
    if (restoredMemoDraft !== undefined) {
      reset({ content: memo.content }, { keepValues: true });
    }
  }, [memo.content, reset, restoredMemoDraft]);

  const [isEditing, setIsEditing] = useState(restoredMemoDraft !== undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { mutateAsync: updateMemo } = useMutation(useUpdateMemoMutationOptions());
  const { mutate: deleteMemo, isPending: isDeletePending } = useMutation(
    useDeleteMemoMutationOptions(),
  );
  const { mutate: togglePin, isPending: isTogglePinPending } = useMutation(
    useToggleMemoPinMutationOptions(),
  );

  const handleSave = handleSubmit(async (data) => {
    try {
      const content = data.content.trim();
      await updateMemo({ memoId, input: { content } });
      reset({ content });
      discardMemoDraft();
      setIsEditing(false);
      Keyboard.dismiss();
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  });

  const handleBack = async () => {
    if (isDirty && isValid) {
      try {
        await updateMemo({ memoId, input: { content: getValues('content').trim() } });
        discardMemoDraft();
      } catch (error) {
        if (!isBusinessError(error)) {
          showBoundary(error);
        }
        return;
      }
    }
    leaveMemo();
  };

  const handleTogglePin = () => {
    impactFeedback(ImpactFeedbackStyle.Light);
    togglePin({ memoId, isPinned: !memo.isPinned });
  };

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

  const backButton = <MemoBackButton onPress={handleBack} />;
  const actionBar = (
    <HStack gap={4} align="center">
      <MemoPinButton
        isPinned={memo.isPinned}
        isDisabled={isTogglePinPending}
        onPress={handleTogglePin}
      />
      <AiParseAction />
      <ConvertToTodoAction
        onConverted={() => {
          leaveMemo();
          navigate('/feed');
        }}
      />
      <MemoDeleteButton onPress={() => setIsDeleteDialogOpen(true)} />
      {isEditing && (
        <MemoSaveButton
          isHighlighted={isDirty && isValid}
          isDisabled={!isValid || isSubmitting}
          onPress={() => handleSave()}
        />
      )}
    </HStack>
  );

  return (
    <FormProvider {...formMethods}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
        {isPane ? (
          <Box className="bg-white">
            <HStack align="center" justify="between" px={8}>
              {backButton}
              {actionBar}
            </HStack>
            <Separator />
          </Box>
        ) : (
          <Stack.Screen options={{ headerLeft: () => backButton, headerRight: () => actionBar }} />
        )}
        <VStack className="flex-1 bg-white">
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

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeletePending) {
            setIsDeleteDialogOpen(open);
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
            onPress={() => setIsDeleteDialogOpen(false)}
            isDisabled={isDeletePending}
          >
            {t('common:actions.cancel')}
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton
            color="danger"
            onPress={handleDelete}
            isLoading={isDeletePending}
          >
            {t('common:actions.delete')}
          </ConfirmDialog.ConfirmButton>
        }
      />
    </FormProvider>
  );
}

function AiParseAction() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('memo');
  const { memoId } = useMemoScreenParams();
  const overlay = useOverlay();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery(useGetTodoCategoriesQueryOptions());
  const aiUsageQuery = useQuery(useGetAiUsageQueryOptions());
  const hasCategory = categoriesQuery.data?.categories[0] != null;

  const handlePress = () => {
    if (getParsedMemo(queryClient, { memoId })) {
      push(memoAiReviewHref(memoId));
      return;
    }

    overlay.open(({ isOpen, close, exit }) => {
      const handleOpenChange = (open: boolean) => {
        if (!open) {
          close();
          exit();
        }
      };

      return (
        <QueryErrorBoundary
          fallback={({ reset }) => (
            <AiParseConfirmDialog.Error
              isOpen={isOpen}
              onOpenChange={handleOpenChange}
              reset={reset}
            />
          )}
        >
          <Suspense fallback={null}>
            <AiParseConfirmDialog isOpen={isOpen} memoId={memoId} onOpenChange={handleOpenChange} />
          </Suspense>
        </QueryErrorBoundary>
      );
    });
  };

  return (
    <MemoActionButton
      onPress={handlePress}
      accessibilityLabel={t('titles.aiReview')}
      isDisabled={!hasCategory || aiUsageQuery.isLoading}
      icon={
        aiUsageQuery.isLoading ? (
          <ActivityIndicator size="small" />
        ) : (
          <RobotIcon width={20} height={20} colorClassName="text-gray-9" />
        )
      }
    />
  );
}

function ConvertToTodoAction({ onConverted }: { onConverted: () => void }) {
  const today = useToday();
  const { t } = useTranslation('memo');
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

  return (
    <MemoActionButton
      onPress={handlePress}
      accessibilityLabel={t('detail.convertToTodo')}
      isDisabled={memo == null || defaultCategoryId == null}
      icon={<CheckboxIcon width={20} height={20} colorClassName="text-gray-9" />}
    />
  );
}
