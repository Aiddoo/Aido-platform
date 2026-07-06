import type { TodoCategoryWithCount } from '@src/features/todo/models/todo-category.model';
import { useDeleteTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/use-delete-todo-category-mutation-options';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, ConfirmDialog, H4, HStack, Spacing, Text, VStack } from '@src/shared/ui';
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
  const { t } = useTranslation(['todo', 'common']);
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
      title={
        <ConfirmDialog.Title>
          {t('category.deleteTitle', { name: category.name })}
        </ConfirmDialog.Title>
      }
      description={
        <ConfirmDialog.Description>{t('category.deleteDescription')}</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          {t('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          onPress={() => handleDelete()}
          isLoading={deleteMutation.isPending}
        >
          {t('common:actions.delete')}
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
  const { t } = useTranslation('todo');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    otherCategories[0]?.id ?? null,
  );

  return (
    <>
      <VStack gap={4}>
        <Dialog.Title>
          <H4>{t('category.todoCount', { count: category.todoCount })}</H4>
        </Dialog.Title>
        <Dialog.Description>
          <Text size="b3" shade={6}>
            {t('category.moveSelect')}
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

const DialogActions = ({ onCancel, onDelete, isPending }: DialogActionsProps) => {
  const { t } = useTranslation('common');
  return (
    <HStack gap={8} justify="end">
      <Button variant="weak" color="dark" size="medium" display="inline" onPress={onCancel}>
        {t('actions.cancel')}
      </Button>
      <Button
        color="danger"
        size="medium"
        display="inline"
        onPress={onDelete}
        isLoading={isPending}
      >
        {t('actions.delete')}
      </Button>
    </HStack>
  );
};

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
