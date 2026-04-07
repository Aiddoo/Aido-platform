import { MemoPolicy } from '@src/features/memo/models/memo.model';
import { useCreateMemoMutationOptions } from '@src/features/memo/presentations/queries/use-create-memo-mutation-options';
import { Box, CheckIcon, CloseIcon, HStack, Text, TextArea } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MemoCreateScreen() {
  const router = useRouter();
  const { top: safeTop } = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const createMutation = useMutation(useCreateMemoMutationOptions());

  const isValid = MemoPolicy.isContentValid(content);
  const isSubmitting = createMutation.isPending;

  const handleSave = () => {
    if (!isValid || isSubmitting) return;
    createMutation.mutate({ content: content.trim() }, { onSuccess: () => router.back() });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Box className="flex-1" px={8} style={{ paddingTop: safeTop + 16 }}>
        <HStack align="center" mb={16}>
          <PressableFeedback
            onPress={() => router.back()}
            isDisabled={isSubmitting}
            style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
            className="items-center justify-center rounded-full"
          >
            <CloseIcon width={28} height={28} colorClassName="text-gray-10" />
          </PressableFeedback>

          <Box className="flex-1 items-center">
            <Text size="b2" weight="medium" shade={10}>
              새 메모
            </Text>
          </Box>

          <PressableFeedback
            onPress={handleSave}
            isDisabled={!isValid || isSubmitting}
            style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
            className={cn(
              'items-center justify-center rounded-full',
              isValid && !isSubmitting ? 'bg-main' : 'bg-gray-4',
            )}
          >
            <CheckIcon width={22} height={22} colorClassName="text-white" />
          </PressableFeedback>
        </HStack>

        <TextArea
          variant="filled"
          label="새 메모 작성"
          placeholder="아이디어를 자유롭게 적어보세요..."
          value={content}
          onChangeText={setContent}
          maxLength={5000}
          autoFocus
          className="flex-1 min-h-[200px]"
        />
      </Box>
    </KeyboardAvoidingView>
  );
}
