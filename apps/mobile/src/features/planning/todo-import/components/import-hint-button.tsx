import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { HintPopoverContent, IconButton, InfoIcon } from '@src/shared/ui';
import { Popover } from 'heroui-native';
import { type ComponentProps, useState } from 'react';

interface ImportHintButtonProps extends Omit<
  ComponentProps<typeof IconButton>,
  'icon' | 'onPress' | 'accessibilityLabel'
> {
  /** 스크린 리더가 읽을 버튼 이름 */
  label: string;
  description: string;
}

const ICON_SIZE = 16;

/** 구역 이름 옆 ⓘ. 말풍선은 아래로 열어 위의 단계 제목을 가리지 않는다 */
export function ImportHintButton({ label, description, ...props }: ImportHintButtonProps) {
  const fontScaledSize = useFontScaledSize();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <IconButton
          accessibilityLabel={label}
          icon={
            <InfoIcon
              width={fontScaledSize(ICON_SIZE)}
              height={fontScaledSize(ICON_SIZE)}
              colorClassName="text-gray-5"
            />
          }
          className="size-4 min-h-0 min-w-0"
          hitSlop={14}
          onPress={() => setIsOpen(true)}
          {...props}
        />
      </Popover.Trigger>
      <HintPopoverContent placement="bottom" align="start" description={description} />
    </Popover>
  );
}
