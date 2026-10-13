import type { ReactElement } from 'react';
import {
  Controller,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type UseControllerProps,
} from 'react-hook-form';

export interface FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> extends UseControllerProps<TFieldValues, TName> {
  children: (
    field: ControllerRenderProps<TFieldValues, TName>,
    fieldState: ControllerFieldState,
  ) => ReactElement;
}

export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  children,
  ...props
}: FormFieldProps<TFieldValues, TName>) {
  return <Controller {...props} render={({ field, fieldState }) => children(field, fieldState)} />;
}
