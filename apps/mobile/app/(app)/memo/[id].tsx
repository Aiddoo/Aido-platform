import { updateMemoSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDeleteMemoMutationOptions } from '@src/features/memo/presentations/queries/use-delete-memo-mutation-options';
import { useGetMemoQueryOptions } from '@src/features/memo/presentations/queries/use-get-memo-query-options';
import { useToggleMemoPinMutationOptions } from '@src/features/memo/presentations/queries/use-toggle-memo-pin-mutation-options';
import { useUpdateMemoMutationOptions } from '@src/features/memo/presentations/queries/use-update-memo-mutation-options';
import { AddTodoBottomSheet } from '@src/features/todo/presentations/components/AddTodoBottomSheet';
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
  TrashIcon,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

const StyledTextInput = withUniwind(TextInput);

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { z } from 'zod';

type UpdateMemoFormInput = z.infer<typeof updateMemoSchema>;

export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memoId = Number(id);
  const { top: safeTop } = useSafeAreaInsets();
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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
  const { data: categoriesData } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const defaultCategoryId = categoriesData.categories[0]?.id;

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
      <VStack className="flex-1 bg-white" style={{ paddingTop: safeTop }}>
        <DetailHeader onBack={handleBack}>
          <ActionButton
            onPress={handleTogglePin}
            isDisabled={isTogglePinPending}
            icon={
              memo.isPinned ? (
                <PinFilledIcon width={20} height={20} colorClassName="text-main" />
              ) : (
                <PinIcon width={20} height={20} colorClassName="text-gray-10" />
              )
            }
          />
          <ActionButton
            onPress={handleConvertToTodo}
            isDisabled={!defaultCategoryId}
            icon={<CheckboxIcon width={20} height={20} colorClassName="text-gray-10" />}
          />
          <ActionButton
            onPress={() => setIsDeleteDialogOpen(true)}
            icon={<TrashIcon width={20} height={20} colorClassName="text-gray-10" />}
          />
          {isEditing && (
            <ActionButton
              onPress={handleSave}
              isDisabled={!isValid || isUpdatePending}
              size={36}
              icon={<CheckmarkIcon width={20} height={20} color="white" />}
              className={cn('rounded-full', isDirty && isValid ? 'bg-main' : 'bg-gray-4')}
            />
          )}
        </DetailHeader>

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

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={<ConfirmDialog.Title>메모를 삭제할까요?</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>삭제한 메모는 복구할 수 없어요</ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton
            onPress={() => setIsDeleteDialogOpen(false)}
            disabled={isDeletePending}
          >
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
    </KeyboardAvoidingView>
  );
}

type PressableProps = ComponentProps<typeof PressableFeedback>;

function DetailHeader({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <HStack align="center" px={8} py={4}>
      <ActionButton
        onPress={onBack}
        icon={<ArrowLeftIcon width={24} height={24} colorClassName="text-gray-10" />}
        size={44}
      />
      <Box flex={1} />
      <HStack gap={4} align="center">
        {children}
      </HStack>
    </HStack>
  );
}

function ActionButton({
  icon,
  size = 40,
  className,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  icon: ReactNode;
  size?: number;
}) {
  return (
    <PressableFeedback
      {...props}
      style={{ width: fontScaledSize(size), height: fontScaledSize(size) }}
      className={cn('items-center justify-center', className)}
    >
      {icon}
    </PressableFeedback>
  );
}
