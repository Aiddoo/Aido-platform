import { updateMemoSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { AiParseConfirmDialog } from '@src/features/memo/presentations/components/AiParseConfirmDialog';
import { useMemoScreenParams } from '@src/features/memo/presentations/hooks/use-memo-screen-params';
import { useGetMemoQueryOptions } from '@src/features/memo/presentations/queries/get-memo-query-options';
import { useDeleteMemoMutationOptions } from '@src/features/memo/presentations/queries/use-delete-memo-mutation-options';
import { useToggleMemoPinMutationOptions } from '@src/features/memo/presentations/queries/use-toggle-memo-pin-mutation-options';
import { useUpdateMemoMutationOptions } from '@src/features/memo/presentations/queries/use-update-memo-mutation-options';
import { AddTodoBottomSheet } from '@src/features/todo/presentations/components/AddTodoBottomSheet';
import { useGetAiUsageQueryOptions } from '@src/features/todo/presentations/queries/get-ai-usage-query-options';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/get-todo-categories-query-options';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useToday } from '@src/shared/hooks/useToday';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  Box,
  CheckboxIcon,
  CheckmarkIcon,
  ConfirmDialog,
  HStack,
  PinFilledIcon,
  PinIcon,
  RobotIcon,
  TrashIcon,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import type { ComponentRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { useFormState } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
} from 'react-native';
import { withUniwind } from 'uniwind';

const StyledTextInput = withUniwind(TextInput);

export default function MemoDetailScreen() {
  const today = useToday();
  const { showBoundary } = useErrorBoundary();
  const goBack = useSingleTap(router.back);
  const navigate = useSingleTap(router.navigate);
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['memo', 'common']);
  const { id: memoId } = useMemoScreenParams();

  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions(memoId));

  const formMethods = useForm({
    resolver: zodResolver(updateMemoSchema),
    defaultValues: { content: memo.content },
  });
  const {
    control,
    handleSubmit,
    getValues,

    reset,
  } = formMethods;
  const { isDirty, isValid, isSubmitting } = useFormState({ control });

  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const { mutateAsync: updateMemo } = useMutation(useUpdateMemoMutationOptions());
  const { mutate: deleteMemo, isPending: isDeletePending } = useMutation(
    useDeleteMemoMutationOptions(),
  );
  const { mutate: togglePin, isPending: isTogglePinPending } = useMutation(
    useToggleMemoPinMutationOptions(),
  );

  const overlay = useOverlay();
  const queryClient = useQueryClient();
  const { data: categoriesData } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const defaultCategoryId = categoriesData.categories[0]?.id;
  const { isLoading: isAiUsageLoading } = useQuery(useGetAiUsageQueryOptions());

  const handleSave = handleSubmit(async (data) => {
    try {
      const content = data.content.trim();
      await updateMemo({ memoId, input: { content } });
      reset({ content });
      setIsEditing(false);
      Keyboard.dismiss();
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
  });

  const handleBack = async () => {
    if (isDirty && isValid) {
      try {
        await updateMemo({ memoId, input: { content: getValues('content').trim() } });
      } catch (error) {
        if (!isBusinessError(error)) showBoundary(error);
        return;
      }
    }
    goBack();
  };

  const handleTogglePin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    togglePin({ memoId, isPinned: !memo.isPinned });
  };

  const handleAiParse = () => {
    const cached = queryClient.getQueryData(AI_QUERY_KEYS.parseMemo(memoId));
    if (cached) {
      push(`/memo/${memoId}/ai-review`);
      return;
    }

    overlay.open(({ isOpen, close, exit }) => (
      <AiParseConfirmDialog
        isOpen={isOpen}
        memoId={memoId}
        onClose={() => {
          close();
          exit();
        }}
      />
    ));
  };

  const handleDelete = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        title={<ConfirmDialog.Title>{t('memo:detail.deleteConfirmTitle')}</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>
            {t('memo:detail.deleteConfirmDescription')}
          </ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton onPress={() => close()} disabled={isDeletePending}>
            {t('common:actions.cancel')}
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton
            color="danger"
            onPress={() => deleteMemo(memoId, { onSuccess: () => goBack() })}
            isLoading={isDeletePending}
          >
            {t('common:actions.delete')}
          </ConfirmDialog.ConfirmButton>
        }
      />
    ));
  };

  const handleConvertToTodo = () => {
    if (!defaultCategoryId) {
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
        onSuccess={() => {
          goBack();
          navigate('/feed');
        }}
      />
    ));
  };

  return (
    <FormProvider {...formMethods}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Stack.Screen
          options={{
            headerLeft: () => (
              <ActionButton
                onPress={handleBack}
                accessibilityLabel={t('common:actions.goBack')}
                icon={<ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />}
              />
            ),
            headerRight: () => (
              <HStack gap={4} align="center">
                <ActionButton
                  onPress={handleTogglePin}
                  accessibilityLabel={t(memo.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin')}
                  disabled={isTogglePinPending}
                  icon={
                    memo.isPinned ? (
                      <PinFilledIcon width={20} height={20} colorClassName="text-main" />
                    ) : (
                      <PinIcon width={20} height={20} colorClassName="text-gray-9" />
                    )
                  }
                />
                <ActionButton
                  onPress={handleAiParse}
                  accessibilityLabel={t('memo:titles.aiReview')}
                  disabled={!defaultCategoryId || isAiUsageLoading}
                  icon={
                    isAiUsageLoading ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <RobotIcon width={20} height={20} colorClassName="text-gray-9" />
                    )
                  }
                />
                <ActionButton
                  onPress={handleConvertToTodo}
                  accessibilityLabel={t('memo:detail.convertToTodo')}
                  disabled={!defaultCategoryId}
                  icon={<CheckboxIcon width={20} height={20} colorClassName="text-gray-9" />}
                />
                <ActionButton
                  onPress={handleDelete}
                  accessibilityLabel={t('common:actions.delete')}
                  icon={<TrashIcon width={20} height={20} colorClassName="text-gray-9" />}
                />
                {isEditing && (
                  <ActionButton
                    onPress={() => handleSave()}
                    accessibilityLabel={t('common:actions.save')}
                    disabled={!isValid || isSubmitting}
                    className={cn('rounded-full', isDirty && isValid ? 'bg-main' : 'bg-gray-4')}
                    icon={<CheckmarkIcon width={20} height={20} color="white" />}
                  />
                )}
              </HStack>
            ),
          }}
        />
        <VStack className="flex-1 bg-white">
          <Box className="flex-1" px={16} py={12}>
            <FormField control={control} name="content">
              {({ value, onChange }) => (
                <StyledTextInput
                  ref={inputRef}
                  value={value}
                  onChangeText={onChange}
                  multiline
                  textAlignVertical="top"
                  allowFontScaling={false}
                  onFocus={() => setIsEditing(true)}
                  className="flex-1 text-gray-8 text-input-lg placeholder:text-gray-5"
                />
              )}
            </FormField>
          </Box>
        </VStack>
      </KeyboardAvoidingView>
    </FormProvider>
  );
}

type ActionButtonProps = Omit<ComponentProps<typeof Pressable>, 'children'> & {
  icon: ReactNode;
  accessibilityLabel: string;
};

function ActionButton({ icon, className, ...props }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      className={cn('items-center justify-center p-2', className)}
      {...props}
    >
      {icon}
    </Pressable>
  );
}
