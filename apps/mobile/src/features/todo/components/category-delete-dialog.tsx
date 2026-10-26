import type { TodoCategoryWithCount } from '@src/features/todo/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useDeleteTodoCategoryMutationOptions } from '@src/features/todo/queries/use-delete-todo-category-mutation-options';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  ConfirmDialog,
  H4,
  HStack,
  READABLE_CONTENT_MAX_WIDTH,
  Spacing,
  Text,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Dialog, Radio, RadioGroup } from 'heroui-native';
import { useState } from 'react';

interface CategoryDeleteDialogProps {
  categoryId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryDeleteDialog({
  categoryId,
  isOpen,
  onOpenChange,
}: CategoryDeleteDialogProps) {
  const { t } = useTranslation(['todo', 'common']);
  const deleteMutation = useMutation(useDeleteTodoCategoryMutationOptions());
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  const category = categoriesResult.categories.find((c) => c.id === categoryId);
  const otherCategories = categoriesResult.categories.filter((c) => c.id !== categoryId);

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
          <Dialog.Content
            className="w-full self-center"
            style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}
          >
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
}

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
  const [selectedValue, setSelectedValue] = useState(String(otherCategories[0]?.id));
  const selectedCategory = otherCategories.find((c) => String(c.id) === selectedValue);

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

      <RadioGroup value={selectedValue} onValueChange={setSelectedValue} className="gap-1.5">
        {otherCategories.map((c) => (
          <CategoryRadioItem key={c.id} category={c} />
        ))}
      </RadioGroup>

      <Spacing size={20} />

      <DialogActions
        onCancel={onCancel}
        onDelete={() => onDelete(selectedCategory?.id ?? null)}
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
}

const CategoryRadioItem = ({ category }: CategoryRadioItemProps) => (
  <RadioGroup.Item value={String(category.id)}>
    <HStack align="center" gap={10} className="rounded-lg px-3 py-2.5">
      <Radio>
        <Radio.Indicator />
      </Radio>
      <HStack align="center" gap={8}>
        <Box className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
        <Text size="b3" weight="medium">
          {category.name}
        </Text>
      </HStack>
    </HStack>
  </RadioGroup.Item>
);
