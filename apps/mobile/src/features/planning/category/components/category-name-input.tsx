import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Input } from '@src/shared/ui';
import type { ComponentProps } from 'react';
import type { FieldError } from 'react-hook-form';

type CategoryNameInputProps = Omit<
  ComponentProps<typeof Input>,
  'autoFocus' | 'label' | 'placeholder' | 'returnKeyType'
>;

export function CategoryNameInput(props: CategoryNameInputProps) {
  const { t } = useTranslation('todo');

  return (
    <Input
      autoFocus
      label={t('category.nameLabel')}
      placeholder={t('category.namePlaceholder')}
      returnKeyType="done"
      {...props}
    />
  );
}

// 스키마의 message는 서버 문구라 쓰지 않고 오류 종류로 고른다
export function getCategoryNameErrorMessage(error: FieldError | undefined) {
  return resolveValidationMessage(error, {
    default: 'categoryName.required',
    byType: { too_big: 'categoryName.tooLong' },
  });
}
