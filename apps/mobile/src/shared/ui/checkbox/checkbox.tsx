import { cn } from '@src/shared/utils/cn';
import { Checkbox as HeroCheckbox } from 'heroui-native';
import type { ComponentProps } from 'react';

type CheckboxProps = ComponentProps<typeof HeroCheckbox>;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <HeroCheckbox
      className={cn('size-5 rounded-md border border-main shadow-none', className)}
      {...props}
    />
  );
}
