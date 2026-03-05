import type { TodoCategoryWithCount } from '@src/features/todo/models/todo-category.model';
import { useDeleteTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/use-delete-todo-category-mutation-options';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { Box } from '@src/shared/ui/Box/Box';
import { Button } from '@src/shared/ui/Button/Button';
import { ConfirmDialog } from '@src/shared/ui/ConfirmDialog';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { H4 } from '@src/shared/ui/Text/Typography';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Dialog } from 'heroui-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

interface CategoryDeleteDialogProps {
  categoryId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CategoryDeleteDialog = ({
  categoryId,
  isOpen,
  onOpenChange,
}: CategoryDeleteDialogProps) => {
  const deleteMutation = useMutation(useDeleteTodoCategoryMutationOptions());
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  const category = data.categories.find((c) => c.id === categoryId);
  const otherCategories = data.categories.filter((c) => c.id !== categoryId);

  if (!category) {
    return null;
  }

  const handleDelete = (moveToCategoryId?: number | null) => {
    const params =
      moveToCategoryId != null
        ? { id: categoryId, query: { moveToCategoryId } }
        : { id: categoryId };

    deleteMutation.mutate(params, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  if (category.todoCount > 0) {
    return (
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40" />
          <Dialog.Content>
            <TodoMoveCategoryDeleteSection
              category={category}
              otherCategories={otherCategories}
              onCancel={() => onOpenChange(false)}
              onDelete={handleDelete}
              isPending={deleteMutation.isPending}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    );
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{category.name} 카테고리를 삭제할까요?</ConfirmDialog.Title>}
      description={<ConfirmDialog.Description>삭제하면 되돌릴 수 없어요</ConfirmDialog.Description>}
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          취소
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          onPress={() => handleDelete()}
          isLoading={deleteMutation.isPending}
        >
          삭제
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
};

interface TodoMoveCategoryDeleteSectionProps {
  category: TodoCategoryWithCount;
  otherCategories: TodoCategoryWithCount[];
  onCancel: () => void;
  onDelete: (moveToCategoryId: number | null) => void;
  isPending: boolean;
}

const TodoMoveCategoryDeleteSection = ({
  category,
  otherCategories,
  onCancel,
  onDelete,
  isPending,
}: TodoMoveCategoryDeleteSectionProps) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    otherCategories[0]?.id ?? null,
  );

  return (
    <>
      <VStack gap={4}>
        <Dialog.Title>
          <H4>할 일 {category.todoCount}개가 포함되어 있어요</H4>
        </Dialog.Title>
        <Dialog.Description>
          <Text size="b3" shade={6}>
            이동할 카테고리를 선택해주세요
          </Text>
        </Dialog.Description>
      </VStack>

      <Spacing size={16} />

      <VStack gap={6}>
        {otherCategories.map((c) => (
          <CategoryRadioItem
            key={c.id}
            category={c}
            isSelected={selectedCategoryId === c.id}
            onSelect={() => setSelectedCategoryId(c.id)}
          />
        ))}
      </VStack>

      <Spacing size={20} />

      <DialogActions
        onCancel={onCancel}
        onDelete={() => onDelete(selectedCategoryId)}
        isPending={isPending}
      />
    </>
  );
};

interface DialogActionsProps {
  onCancel: () => void;
  onDelete: () => void;
  isPending: boolean;
}

const DialogActions = ({ onCancel, onDelete, isPending }: DialogActionsProps) => (
  <HStack gap={8} justify="end">
    <Button variant="weak" color="dark" size="medium" display="inline" onPress={onCancel}>
      취소
    </Button>
    <Button color="danger" size="medium" display="inline" onPress={onDelete} isLoading={isPending}>
      삭제
    </Button>
  </HStack>
);

interface CategoryRadioItemProps {
  category: TodoCategoryWithCount;
  isSelected: boolean;
  onSelect: () => void;
}

const CategoryRadioItem = ({ category, isSelected, onSelect }: CategoryRadioItemProps) => (
  <Pressable onPress={onSelect}>
    <HStack align="center" gap={10} className="rounded-lg px-3 py-2.5">
      <Box
        className={cn(
          'size-[18px] rounded-full border-2 items-center justify-center',
          isSelected ? 'border-accent' : 'border-gray-4',
        )}
      >
        {isSelected && <Box className="size-[10px] rounded-full bg-accent" />}
      </Box>
      <HStack align="center" gap={8}>
        <Box className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
        <Text size="b3" weight="medium">
          {category.name}
        </Text>
      </HStack>
    </HStack>
  </Pressable>
);
