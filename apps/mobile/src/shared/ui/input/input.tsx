import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

import { Box } from '../box/box';
import { Text } from '../text/text';
import { type FocusedFieldNode, useReportFocusedField } from './focused-field';
import type { InputInternalProps } from './input.types';
import {
  INPUT_TEXT_SIZES,
  inputContainerVariants,
  inputLabelVariants,
  inputTextVariants,
} from './input.variants';

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
  const fieldRef = useRef<FocusedFieldNode | null>(null);
  const reportFocusedField = useReportFocusedField(fieldRef);
  const InputComponent = textInputComponent ?? StyledTextInput;
  const { resolveSize } = useFontScale();

  return (
    <Box
      ref={fieldRef}
      className="gap-1"
      onLayout={() => {
        // 오류 문구가 여러 줄이 되는 등 칸 높이가 바뀌면 칸 전체를 다시 알린다
        if (isFocused) {
          reportFocusedField(true);
        }
      }}
    >
      {label != null && label.length > 0 && (
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
          className={inputTextVariants({
            fontSize: resolveSize(INPUT_TEXT_SIZES[size]),
            hasLeftContent: !!leftContent,
          })}
          onFocus={(event) => {
            setIsFocused(true);
            reportFocusedField(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            reportFocusedField(false);
            onBlur?.(event);
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
