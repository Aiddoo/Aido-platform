import { EyeIcon, EyeOffIcon } from '@src/shared/ui/Icon/icons';
import { Input, type InputProps } from '@src/shared/ui/Input';
import { forwardRef, useState } from 'react';
import { Pressable, type TextInput } from 'react-native';

export interface PasswordInputProps extends Omit<InputProps, 'secureTextEntry' | 'rightContent'> {}

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>((props, ref) => {
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
