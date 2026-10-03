import { useTranslation } from '@src/shared/i18n';
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
  const { t } = useTranslation('auth');
  const [isSecure, setIsSecure] = useState(true);

  return (
    <Input
      ref={ref}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={isSecure}
      rightContent={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(isSecure ? 'forms.showPassword' : 'forms.hidePassword')}
          className="min-w-11 min-h-11 items-center justify-center"
          onPress={() => setIsSecure((value) => !value)}
        >
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
