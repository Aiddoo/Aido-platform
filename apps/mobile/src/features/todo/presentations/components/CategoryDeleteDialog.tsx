import { isTodoCategoryError } from '@src/features/todo/models/todo-category.error';
import type { TodoCategoryWithCount } from '@src/features/todo/models/todo-category.model';
import { deleteTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/delete-todo-category-mutation-options';
import { getTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/get-todo-categories-query-options';
import { isApiError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { Box } from '@src/shared/ui/Box/Box';
import { Button } from '@src/shared/ui/Button/Button';
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
  const toast = useAppToast();
  const deleteMutation = useMutation(deleteTodoCategoryMutationOptions());
  const { data } = useSuspenseQuery(getTodoCategoriesQueryOptions());

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
        toast.success('카테고리를 삭제했어요');
        onOpenChange(false);
      },
      onError: (error) => {
        if (isTodoCategoryError(error) || isApiError(error)) {
          toast.error(error.message);
          return;
        }
        toast.error(undefined, { fallback: '잠시 후 다시 삭제해 보세요' });
      },
    });
  };

  const categoryHasTodos = category.todoCount > 0;

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/40" />
        <Dialog.Content>
          {categoryHasTodos ? (
            <TodoMoveCategoryDeleteSection
              category={category}
              otherCategories={otherCategories}
              onDelete={handleDelete}
              isPending={deleteMutation.isPending}
            />
          ) : (
            <CategoryDeleteSection
              categoryName={category.name}
              onDelete={() => handleDelete()}
              isPending={deleteMutation.isPending}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

const CategoryDeleteSection = ({
  categoryName,
  onDelete,
  isPending,
}: {
  categoryName: string;
  onDelete: () => void;
  isPending: boolean;
}) => (
  <>
    <VStack gap={4}>
      <Dialog.Title>
        <H4>{categoryName} 카테고리를 삭제할까요?</H4>
      </Dialog.Title>
      <Dialog.Description>
        <Text size="b3" shade={6}>
          삭제하면 되돌릴 수 없어요
        </Text>
      </Dialog.Description>
    </VStack>
    <Spacing size={20} />
    <DialogActions onDelete={onDelete} isPending={isPending} />
  </>
);

const TodoMoveCategoryDeleteSection = ({
  category,
  otherCategories,
  onDelete,
  isPending,
}: {
  category: TodoCategoryWithCount;
  otherCategories: TodoCategoryWithCount[];
  onDelete: (moveToCategoryId: number | null) => void;
  isPending: boolean;
}) => {
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

      <DialogActions onDelete={() => onDelete(selectedCategoryId)} isPending={isPending} />
    </>
  );
};

const DialogActions = ({ onDelete, isPending }: { onDelete: () => void; isPending: boolean }) => (
  <HStack gap={8} justify="end">
    <Dialog.Close asChild>
      <Button variant="weak" color="dark" size="medium" display="inline">
        취소
      </Button>
    </Dialog.Close>
    <Button color="danger" size="medium" display="inline" onPress={onDelete} isLoading={isPending}>
      삭제
    </Button>
  </HStack>
);

const CategoryRadioItem = ({
  category,
  isSelected,
  onSelect,
}: {
  category: TodoCategoryWithCount;
  isSelected: boolean;
  onSelect: () => void;
}) => (
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
