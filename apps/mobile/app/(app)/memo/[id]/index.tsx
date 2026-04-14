import { updateMemoSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { AiParseConfirmDialog } from '@src/features/memo/presentations/components/AiParseConfirmDialog';
import { useDeleteMemoMutationOptions } from '@src/features/memo/presentations/queries/use-delete-memo-mutation-options';
import { useGetMemoQueryOptions } from '@src/features/memo/presentations/queries/use-get-memo-query-options';
import { useToggleMemoPinMutationOptions } from '@src/features/memo/presentations/queries/use-toggle-memo-pin-mutation-options';
import { useUpdateMemoMutationOptions } from '@src/features/memo/presentations/queries/use-update-memo-mutation-options';
import { AddTodoBottomSheet } from '@src/features/todo/presentations/components/AddTodoBottomSheet';
import { useGetAiUsageQueryOptions } from '@src/features/todo/presentations/queries/use-get-ai-usage-query-options';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
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
import { cn } from '@src/shared/utils/cn';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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

import type { z } from 'zod';

type UpdateMemoFormInput = z.infer<typeof updateMemoSchema>;

export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memoId = Number(id);
  const router = useRouter();

  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions(memoId));

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isDirty, isValid },
    reset,
  } = useForm<UpdateMemoFormInput>({
    resolver: zodResolver(updateMemoSchema),
    defaultValues: { content: memo.content },
  });

  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const { mutate: updateMemo, isPending: isUpdatePending } = useMutation(
    useUpdateMemoMutationOptions(),
  );
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

  const handleSave = handleSubmit((data) => {
    updateMemo(
      {
        memoId,
        input: {
          content: data.content.trim(),
        },
      },
      {
        onSuccess: () => {
          reset({
            content: data.content.trim(),
          });
          setIsEditing(false);
          Keyboard.dismiss();
        },
      },
    );
  });

  const handleBack = () => {
    if (isDirty && isValid) {
      const content = getValues('content').trim();
      updateMemo(
        {
          memoId,
          input: { content },
        },
        {
          onSuccess: () => router.back(),
        },
      );
      return;
    }
    router.back();
  };

  const handleTogglePin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    togglePin({ memoId, isPinned: !memo.isPinned });
  };

  const handleAiParse = () => {
    const cached = queryClient.getQueryData(AI_QUERY_KEYS.parseMemo(memoId));
    if (cached) {
      router.push(`/memo/${memoId}/ai-review`);
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
        title={<ConfirmDialog.Title>메모를 삭제할까요?</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>삭제한 메모는 복구할 수 없어요</ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton onPress={() => close()} disabled={isDeletePending}>
            취소
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton
            color="danger"
            onPress={() => deleteMemo(memoId, { onSuccess: () => router.back() })}
            isLoading={isDeletePending}
          >
            삭제
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
        selectedDate={new Date()}
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
          router.back();
          router.navigate('/feed');
        }}
      />
    ));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerLeft: () => (
            <ActionButton
              onPress={handleBack}
              icon={<ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />}
            />
          ),
          headerRight: () => (
            <HStack gap={4} align="center">
              <ActionButton
                onPress={handleTogglePin}
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
                disabled={!defaultCategoryId}
                icon={<CheckboxIcon width={20} height={20} colorClassName="text-gray-9" />}
              />
              <ActionButton
                onPress={handleDelete}
                icon={<TrashIcon width={20} height={20} colorClassName="text-gray-9" />}
              />
              {isEditing && (
                <ActionButton
                  onPress={handleSave}
                  disabled={!isValid || isUpdatePending}
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
          <Controller
            control={control}
            name="content"
            render={({ field: { value, onChange } }) => (
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
          />
        </Box>
      </VStack>
    </KeyboardAvoidingView>
  );
}

type ActionButtonProps = Omit<ComponentProps<typeof Pressable>, 'children'> & {
  icon: ReactNode;
};

function ActionButton({ icon, className, ...props }: ActionButtonProps) {
  return (
    <Pressable hitSlop={4} className={cn('items-center justify-center p-2', className)} {...props}>
      {icon}
    </Pressable>
  );
}
