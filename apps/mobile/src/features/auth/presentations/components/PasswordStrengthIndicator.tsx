import { PASSWORD_RULES } from '@aido/validators';
import { PasswordPolicy } from '@src/features/auth/models/auth.model';
import { useTranslation } from '@src/shared/i18n';
import { CheckmarkIcon, HStack, Text } from '@src/shared/ui';

export interface PasswordStrengthIndicatorProps {
  password: string | undefined;
}

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const { t } = useTranslation('auth');
  const value = password || '';

  return (
    <HStack gap={16} className="items-center">
      <RuleItem satisfied={PasswordPolicy.hasLetter(value)} label={t('passwordRules.hasLetter')} />
      <RuleItem satisfied={PasswordPolicy.hasNumber(value)} label={t('passwordRules.hasNumber')} />
      <RuleItem
        satisfied={PasswordPolicy.hasMinLength(value)}
        label={t('passwordRules.minLength', { count: PASSWORD_RULES.MIN_LENGTH })}
      />
    </HStack>
  );
};

function RuleItem({ satisfied, label }: { satisfied: boolean; label: string }) {
  const color = satisfied ? 'text-success' : 'text-gray-5';

  return (
    <HStack gap={4} className="items-center">
      <CheckmarkIcon colorClassName={color} width={14} height={14} />
      <Text className={color} size="b4">
        {label}
      </Text>
    </HStack>
  );
}
