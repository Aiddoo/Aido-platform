import { useTranslation } from '@src/shared/i18n';
import { EyeIcon, EyeOffIcon, IconButton, Input } from '@src/shared/ui';
import { useState, type ComponentProps } from 'react';

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
        <IconButton
          accessibilityLabel={t(isSecure ? 'forms.showPassword' : 'forms.hidePassword')}
          icon={
            isSecure ? (
              <EyeIcon colorClassName="text-gray-5" />
            ) : (
              <EyeOffIcon colorClassName="text-gray-5" />
            )
          }
          onPress={() => setIsSecure((value) => !value)}
        />
      }
      {...props}
    />
  );
}
