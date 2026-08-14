import { cn } from '@src/shared/utils/cn';
import { forwardRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { Text } from '../Text/Text';
import { VStack } from '../VStack/VStack';
import type { TextAreaInternalProps } from './TextArea.types';
import {
  textAreaContainerVariants,
  textAreaLabelVariants,
  textAreaTextVariants,
} from './TextArea.variants';

const StyledTextInput = withUniwind(TextInput);

export const TextArea = forwardRef<TextInput, TextAreaInternalProps>(
  (
    {
      variant = 'filled',
      label,
      isDisabled = false,
      isInvalid = false,
      errorMessage,
      placeholder,
      className,
      textInputComponent,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const InputComponent = textInputComponent ?? StyledTextInput;

    return (
      <View className="gap-2">
        {label && (
          <Text
            size="e1"
            weight="medium"
            className={textAreaLabelVariants({ isFocused, isInvalid })}
          >
            {label}
          </Text>
        )}
        <VStack gap={4}>
          <View
            className={cn(
              textAreaContainerVariants({ variant, isFocused, isDisabled, isInvalid }),
              className,
            )}
          >
            <InputComponent
              ref={ref}
              allowFontScaling={false}
              placeholder={placeholder}
              editable={!isDisabled}
              multiline
              textAlignVertical="top"
              className={textAreaTextVariants()}
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
          </View>
          <Text size="e1" className={cn('text-error', !errorMessage && 'opacity-0')}>
            {errorMessage ?? ' '}
          </Text>
        </VStack>
      </View>
    );
  },
);

TextArea.displayName = 'TextArea';
