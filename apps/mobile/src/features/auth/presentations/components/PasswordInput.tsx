import { EyeIcon, EyeOffIcon, Input } from '@src/shared/ui';
import type {
  ComponentRef,
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes,
} from 'react';
import { forwardRef, useState, type ComponentProps } from 'react';
import type { TextInput } from 'react-native';
import { Pressable } from 'react-native';

export interface PasswordInputProps extends Omit<
  ComponentProps<typeof Input>,
  'secureTextEntry' | 'rightContent'
> {}

export const PasswordInput: ForwardRefExoticComponent<
  PropsWithoutRef<PasswordInputProps> & RefAttributes<ComponentRef<typeof TextInput>>
> = forwardRef<ComponentRef<typeof TextInput>, PasswordInputProps>((props, ref) => {
  const [isSecure, setIsSecure] = useState(true);

  return (
    <Input
      ref={ref}
      secureTextEntry={isSecure}
      rightContent={
        <Pressable onPress={() => setIsSecure((v) => !v)}>
          {isSecure ? (
            <EyeIcon colorClassName="text-gray-5" />
          ) : (
            <EyeOffIcon colorClassName="text-gray-5" />
          )}
        </Pressable>
      }
      {...props}
    />
  );
});

PasswordInput.displayName = 'PasswordInput';
