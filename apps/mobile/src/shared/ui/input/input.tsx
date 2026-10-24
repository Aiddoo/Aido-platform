import { cn } from '@src/shared/utils/cn';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

import { Box } from '../box';
import { Text } from '../text/text';
import type { InputInternalProps } from './input.types';
import { inputContainerVariants, inputLabelVariants, inputTextVariants } from './input.variants';

const StyledTextInput = withUniwind(TextInput);

export function Input({
  ref,
  variant = 'filled',
  size = 'large',
  label,
  isDisabled = false,
  isInvalid = false,
  errorMessage,
  renderErrorMessage = true,
  leftContent,
  rightContent,
  placeholder,
  className,
  value,
  onChange,
  onFocus,
  onBlur,
  textInputComponent,
  ...props
}: InputInternalProps) {
  const [isFocused, setIsFocused] = useState(false);
  const InputComponent = textInputComponent ?? StyledTextInput;

  return (
    <Box className="gap-1">
      {label && (
        <Text size="e1" weight="medium" className={inputLabelVariants({ isFocused, isInvalid })}>
          {label}
        </Text>
      )}
      <Box
        className={cn(
          inputContainerVariants({ variant, size, isFocused, isDisabled, isInvalid }),
          className,
        )}
      >
        {leftContent && <Box className="mr-3">{leftContent}</Box>}
        <InputComponent
          ref={ref}
          value={value}
          onChangeText={onChange}
          allowFontScaling={false}
          placeholder={placeholder}
          editable={!isDisabled}
          className={inputTextVariants({ size, hasLeftContent: !!leftContent })}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {rightContent && <Box className="ml-3">{rightContent}</Box>}
      </Box>
      {renderErrorMessage && (
        <Text size="e1" className={cn('ml-1', errorMessage ? 'text-error' : 'opacity-0')}>
          {errorMessage || ' '}
        </Text>
      )}
    </Box>
  );
}
