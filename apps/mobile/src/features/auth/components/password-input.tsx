import { useTranslation } from '@src/shared/i18n';
import { EyeIcon, EyeOffIcon, Input } from '@src/shared/ui';
import { useState, type ComponentProps } from 'react';
import { Pressable } from 'react-native';

export interface PasswordInputProps extends Omit<
  ComponentProps<typeof Input>,
  'secureTextEntry' | 'rightContent'
> {}

export function PasswordInput(props: PasswordInputProps) {
  const { t } = useTranslation('auth');
  const [isSecure, setIsSecure] = useState(true);

  return (
    <Input
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
}
