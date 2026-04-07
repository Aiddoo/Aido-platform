import { MemoPolicy } from '@src/features/memo/models/memo.model';
import { useConvertMemoToTodoMutationOptions } from '@src/features/memo/presentations/queries/use-convert-memo-to-todo-mutation-options';
import { useDeleteMemoMutationOptions } from '@src/features/memo/presentations/queries/use-delete-memo-mutation-options';
import { useGetMemosQueryOptions } from '@src/features/memo/presentations/queries/use-get-memos-query-options';
import { useToggleMemoPinMutationOptions } from '@src/features/memo/presentations/queries/use-toggle-memo-pin-mutation-options';
import { useUpdateMemoMutationOptions } from '@src/features/memo/presentations/queries/use-update-memo-mutation-options';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import {
  ArrowLeftIcon,
  Box,
  CheckboxIcon,
  CheckIcon,
  ConfirmDialog,
  EditIcon,
  HStack,
  PinIcon,
  Text,
  TextArea,
  TrashIcon,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatDate } from '@src/shared/utils/date';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memoId = Number(id);
  const router = useRouter();
  const { top: safeTop } = useSafeAreaInsets();

  const { data } = useSuspenseInfiniteQuery(useGetMemosQueryOptions());
  const memo = data.pages.flatMap((page) => page.items).find((m) => m.id === memoId);

  useEffect(() => {
    if (!memo) {
      router.back();
    }
  }, [memo, router]);

  if (!memo) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Box className="flex-1" style={{ paddingTop: safeTop }}>
        <MemoDetailContent memoId={memoId} initialContent={memo.content} isPinned={memo.isPinned} />
      </Box>
    </KeyboardAvoidingView>
  );
}

interface MemoDetailContentProps {
  memoId: number;
  initialContent: string;
  isPinned: boolean;
}

function MemoDetailContent({ memoId, initialContent, isPinned }: MemoDetailContentProps) {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [localPinned, setLocalPinned] = useState(isPinned);

  const updateMutation = useMutation(useUpdateMemoMutationOptions());
  const deleteMutation = useMutation(useDeleteMemoMutationOptions());
  const togglePinMutation = useMutation(useToggleMemoPinMutationOptions());
  const convertMutation = useMutation(useConvertMemoToTodoMutationOptions());

  const { data: categoriesData } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const defaultCategoryId = categoriesData.categories[0]?.id;

  const handleSaveEdit = () => {
    if (!MemoPolicy.isContentValid(content)) return;
    updateMutation.mutate(
      { memoId, input: { content: content.trim() } },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleTogglePin = () => {
    const newPinned = !localPinned;
    setLocalPinned(newPinned);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    togglePinMutation.mutate({ memoId, isPinned: newPinned });
  };

  const handleDelete = () => {
    deleteMutation.mutate(memoId, {
      onSuccess: () => router.back(),
    });
  };

  const handleConvertToTodo = () => {
    if (!defaultCategoryId) return;

    convertMutation.mutate(
      {
        memoId,
        input: {
          categoryId: defaultCategoryId,
          startDate: formatDate(new Date()),
          isAllDay: true,
          visibility: 'PUBLIC',
        },
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <>
      <VStack className="flex-1">
        <HStack align="center" px={8} py={4}>
          <PressableFeedback
            onPress={() => router.back()}
            style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
            className="items-center justify-center"
          >
            <ArrowLeftIcon width={24} height={24} colorClassName="text-gray-10" />
          </PressableFeedback>

          <Box flex={1} />

          <HStack gap={4}>
            {isEditing ? (
              <PressableFeedback
                onPress={handleSaveEdit}
                isDisabled={!MemoPolicy.isContentValid(content) || updateMutation.isPending}
                style={{ width: fontScaledSize(40), height: fontScaledSize(40) }}
                className={cn(
                  'items-center justify-center rounded-full',
                  MemoPolicy.isContentValid(content) ? 'bg-main' : 'bg-gray-4',
                )}
              >
                <CheckIcon width={20} height={20} colorClassName="text-white" />
              </PressableFeedback>
            ) : (
              <>
                <ActionButton
                  onPress={() => setIsEditing(true)}
                  icon={<EditIcon width={20} height={20} colorClassName="text-gray-10" />}
                />
                <ActionButton
                  onPress={handleTogglePin}
                  isDisabled={togglePinMutation.isPending}
                  icon={
                    <PinIcon
                      width={20}
                      height={20}
                      colorClassName={localPinned ? 'text-main' : 'text-gray-10'}
                    />
                  }
                />
                <ActionButton
                  onPress={() => setIsConvertDialogOpen(true)}
                  isDisabled={!defaultCategoryId}
                  icon={<CheckboxIcon width={20} height={20} colorClassName="text-gray-10" />}
                />
                <ActionButton
                  onPress={() => setIsDeleteDialogOpen(true)}
                  icon={<TrashIcon width={20} height={20} colorClassName="text-gray-10" />}
                />
              </>
            )}
          </HStack>
        </HStack>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {isEditing ? (
            <TextArea
              variant="filled"
              value={content}
              onChangeText={setContent}
              maxLength={5000}
              autoFocus
              className="flex-1 min-h-[300px]"
            />
          ) : (
            <Box className="rounded-xl bg-gray-1" p={16}>
              <Text size="b2" shade={10} style={{ lineHeight: 26 }}>
                {initialContent}
              </Text>
            </Box>
          )}
        </ScrollView>
      </VStack>

      <ConfirmDialog
        isOpen={isConvertDialogOpen}
        onOpenChange={setIsConvertDialogOpen}
        title={<ConfirmDialog.Title>할 일로 옮길까요?</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>
            이 메모가 오늘의 할 일로 등록되고, 메모에서는 사라져요
          </ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton
            onPress={() => setIsConvertDialogOpen(false)}
            disabled={convertMutation.isPending}
          >
            취소
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton
            onPress={handleConvertToTodo}
            isLoading={convertMutation.isPending}
          >
            옮기기
          </ConfirmDialog.ConfirmButton>
        }
      />

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
            disabled={deleteMutation.isPending}
          >
            취소
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton
            color="danger"
            onPress={handleDelete}
            isLoading={deleteMutation.isPending}
          >
            삭제
          </ConfirmDialog.ConfirmButton>
        }
      />
    </>
  );
}

interface ActionButtonProps {
  onPress: () => void;
  icon: ReactNode;
  isDisabled?: boolean;
}

function ActionButton({ onPress, icon, isDisabled }: ActionButtonProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={isDisabled}
      style={{ width: fontScaledSize(40), height: fontScaledSize(40) }}
      className="items-center justify-center"
    >
      {icon}
    </PressableFeedback>
  );
}
