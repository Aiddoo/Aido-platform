import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { BottomSheetInput, VStack } from '@src/shared/ui';
import { Controller, type Control } from 'react-hook-form';

import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import { CategoryColorInput } from './category-color-input';

interface CategoryFormFieldsProps {
  control: Control<TodoCategoryFormValues>;
  onSubmit: () => void;
}

/** 만들기와 고치기 시트가 함께 쓰는 이름·색 입력. 제출은 각 시트가 맡는다 */
export function CategoryFormFields({ control, onSubmit }: CategoryFormFieldsProps) {
  const { t } = useTranslation('todo');

  return (
    <VStack gap={20}>
      <Controller
        control={control}
        name="name"
        render={({ field: { value, onChange, ref }, fieldState: { error } }) => (
          <BottomSheetInput
            ref={ref}
            autoFocus
            label={t('category.nameLabel')}
            placeholder={t('category.namePlaceholder')}
            value={value}
            onChange={onChange}
            isInvalid={error != null}
            errorMessage={resolveValidationMessage(error, {
              default: 'categoryName.required',
              byType: { too_big: 'categoryName.tooLong' },
            })}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        )}
      />

      <Controller
        control={control}
        name="color"
        render={({ field: { value, onChange } }) => (
          <CategoryColorInput value={value} onValueChange={onChange} />
        )}
      />
    </VStack>
  );
}
