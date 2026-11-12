import { PASSWORD_RULES } from '@aido/api/vocabulary';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { CheckmarkIcon, HStack, Text } from '@src/shared/ui';

import { hasLetter, hasMinLength, hasNumber } from '../domains/password.model';

export interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation('auth');

  return (
    <HStack gap={16} className="items-center">
      <RuleItem isSatisfied={hasLetter(password)} label={t('passwordRules.hasLetter')} />
      <RuleItem isSatisfied={hasNumber(password)} label={t('passwordRules.hasNumber')} />
      <RuleItem
        isSatisfied={hasMinLength(password)}
        label={t('passwordRules.minLength', { count: PASSWORD_RULES.MIN_LENGTH })}
      />
    </HStack>
  );
}

function RuleItem({ isSatisfied, label }: { isSatisfied: boolean; label: string }) {
  const fontScaledSize = useFontScaledSize();
  const color = isSatisfied ? 'text-success' : 'text-gray-5';

  return (
    <HStack gap={4} className="items-center">
      <CheckmarkIcon
        colorClassName={color}
        width={fontScaledSize(14)}
        height={fontScaledSize(14)}
      />
      <Text className={color} size="b4">
        {label}
      </Text>
    </HStack>
  );
}
