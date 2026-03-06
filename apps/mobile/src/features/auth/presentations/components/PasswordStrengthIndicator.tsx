import { PASSWORD_RULES } from '@aido/validators';
import { PasswordPolicy } from '@src/features/auth/models/auth.model';
import { HStack } from '@src/shared/ui/HStack';
import { CheckmarkIcon } from '@src/shared/ui/Icon/icons';
import { Text } from '@src/shared/ui/Text';

export interface PasswordStrengthIndicatorProps {
  password: string | undefined;
}

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const value = password || '';

  return (
    <HStack gap={16} className="items-center">
      <RuleItem satisfied={PasswordPolicy.hasLetter(value)} label="영문 포함" />
      <RuleItem satisfied={PasswordPolicy.hasNumber(value)} label="숫자 포함" />
      <RuleItem
        satisfied={PasswordPolicy.hasMinLength(value)}
        label={`${PASSWORD_RULES.MIN_LENGTH}자 이상`}
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
