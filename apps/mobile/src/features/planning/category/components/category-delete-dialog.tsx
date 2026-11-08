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
  usePortalTarget,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Dialog, Radio, RadioGroup } from 'heroui-native';
import { useState } from 'react';

import { TodoCategoryPolicy } from '../domains/todo-category.model';
import type { TodoCategoryWithCount } from '../domains/todo-category.model';
import { useDeleteTodoCategoryMutationOptions } from '../queries/todo-category.mutations';
import { useGetTodoCategoriesQueryOptions } from '../queries/todo-category.queries';

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
  const portalTarget = usePortalTarget();

  const category = TodoCategoryPolicy.findCategory(categoriesResult.categories, categoryId);
  const otherCategories = TodoCategoryPolicy.getMoveTargetCategories(
    categoriesResult.categories,
    categoryId,
  );

  if (!category) {
    return null;
  }

  const handleDelete = (moveToCategoryId?: number) => {
    const params =
      moveToCategoryId == null
        ? { id: categoryId }
        : { id: categoryId, query: { moveToCategoryId } };

    deleteMutation.mutate(params, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  if (TodoCategoryPolicy.isTodoMoveRequired(category)) {
    return (
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
        <Dialog.Portal {...portalTarget}>
          <Dialog.Overlay className="bg-black/40" />
          <Dialog.Content
            className="w-full self-center"
            style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}
          >
            <CategoryMoveDeleteForm
              category={category}
              otherCategories={otherCategories}
              onCancel={() => onOpenChange(false)}
              onDelete={handleDelete}
              isLoading={deleteMutation.isPending}
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
          color="danger"
          onPress={() => handleDelete()}
          isLoading={deleteMutation.isPending}
        >
          {t('common:actions.delete')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

interface CategoryMoveDeleteFormProps {
  category: TodoCategoryWithCount;
  otherCategories: TodoCategoryWithCount[];
  onCancel: () => void;
  onDelete: (moveToCategoryId: number) => void;
  isLoading: boolean;
}

function CategoryMoveDeleteForm({
  category,
  otherCategories,
  onCancel,
  onDelete,
  isLoading,
}: CategoryMoveDeleteFormProps) {
  const { t } = useTranslation('todo');
  const [selectedValue, setSelectedValue] = useState(String(otherCategories[0]?.id ?? ''));
  const selectedCategory = otherCategories.find(
    (candidate) => String(candidate.id) === selectedValue,
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

      <RadioGroup value={selectedValue} onValueChange={setSelectedValue} className="gap-1.5">
        {otherCategories.map((otherCategory) => (
          <CategoryRadioItem key={otherCategory.id} category={otherCategory} />
        ))}
      </RadioGroup>

      <Spacing size={20} />

      <DialogActions
        onCancel={onCancel}
        onDelete={() => {
          if (selectedCategory != null) {
            onDelete(selectedCategory.id);
          }
        }}
        isDisabled={selectedCategory == null}
        isLoading={isLoading}
      />
    </>
  );
}

interface DialogActionsProps {
  onCancel: () => void;
  onDelete: () => void;
  isDisabled: boolean;
  isLoading: boolean;
}

function DialogActions({ onCancel, onDelete, isDisabled, isLoading }: DialogActionsProps) {
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
        isDisabled={isDisabled}
        isLoading={isLoading}
      >
        {t('actions.delete')}
      </Button>
    </HStack>
  );
}

interface CategoryRadioItemProps {
  category: TodoCategoryWithCount;
}

function CategoryRadioItem({ category }: CategoryRadioItemProps) {
  return (
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
}
