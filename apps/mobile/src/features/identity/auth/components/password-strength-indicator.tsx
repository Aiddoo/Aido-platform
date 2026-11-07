import { PASSWORD_RULES } from '@aido/api/vocabulary';
import { useTranslation } from '@src/shared/i18n';
import { CheckmarkIcon, HStack, Text } from '@src/shared/ui';

import { PasswordPolicy } from '../domains/password.model';

export interface PasswordStrengthIndicatorProps {
  password: string | undefined;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation('auth');
  const value = password || '';

  return (
    <HStack gap={16} className="items-center">
      <RuleItem
        isSatisfied={PasswordPolicy.hasLetter(value)}
        label={t('passwordRules.hasLetter')}
      />
      <RuleItem
        isSatisfied={PasswordPolicy.hasNumber(value)}
        label={t('passwordRules.hasNumber')}
      />
      <RuleItem
        isSatisfied={PasswordPolicy.hasMinLength(value)}
        label={t('passwordRules.minLength', { count: PASSWORD_RULES.MIN_LENGTH })}
      />
    </HStack>
  );
}

function RuleItem({ isSatisfied, label }: { isSatisfied: boolean; label: string }) {
  const color = isSatisfied ? 'text-success' : 'text-gray-5';

  return (
    <HStack gap={4} className="items-center">
      <CheckmarkIcon colorClassName={color} width={14} height={14} />
      <Text className={color} size="b4">
        {label}
      </Text>
    </HStack>
  );
}
