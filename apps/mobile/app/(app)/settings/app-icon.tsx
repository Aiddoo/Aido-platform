import { APP_ICONS } from '@src/features/app-icon/constants/app-icons.constant';
import { useAppIcon } from '@src/features/app-icon/hooks/use-app-icon';
import type { AppIconKey } from '@src/features/app-icon/types/app-icon.types';
import {
  Avatar,
  Box,
  ConfirmDialog,
  Grid,
  GridItem,
  HStack,
  Spacing,
  StyledSafeAreaView,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import { Platform, ScrollView } from 'react-native';

const AppIconScreen = () => {
  const { currentIcon, isSupported, isChanging, changeIcon } = useAppIcon();
  const overlay = useOverlay();

  const handleIconPress = (key: AppIconKey) => {
    const applyIcon = async () => {
      try {
        await changeIcon(key);
      } catch {
        overlay.open(({ isOpen, close, exit }) => (
          <AppIconErrorDialog
            isOpen={isOpen}
            onOpenChange={(open) => {
              if (!open) {
                close();
                exit();
              }
            }}
          />
        ));
      }
    };

    if (Platform.OS === 'android') {
      overlay.open(({ isOpen, close, exit }) => (
        <AppIconRestartDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
          onConfirm={() => {
            close();
            exit();
            applyIcon();
          }}
        />
      ));
    } else {
      applyIcon();
    }
  };

  if (!isSupported) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
        <ScrollView className="px-4 flex-1">
          <Spacing size={8} />
          <HStack justify="center" align="center">
            <Text size="b4" shade={6}>
              이 기기에서는 앱 아이콘 변경을 지원하지 않아요
            </Text>
          </HStack>
        </ScrollView>
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={8} />
        <Text size="b4" shade={6} className="px-2 pb-2">
          홈 화면에 표시될 앱 아이콘을 선택하세요
        </Text>

        <Box p={16} className="bg-white rounded-2xl">
          <Grid columns={3}>
            {APP_ICONS.map((icon) => {
              const selected = icon.key === currentIcon;
              return (
                <GridItem key={icon.key} p={8} className="items-center">
                  <PressableFeedback
                    isDisabled={isChanging}
                    onPress={() => handleIconPress(icon.key)}
                    className="rounded-2xl overflow-visible"
                  >
                    <VStack align="center" gap={8} py={8} className="overflow-visible">
                      <Avatar
                        isSelected={selected}
                        alt={icon.label}
                        className="w-20 h-20 rounded-2xl"
                      >
                        <Avatar.Image source={icon.preview} />
                      </Avatar>
                      <Text
                        size="b4"
                        weight={selected ? 'semibold' : 'normal'}
                        shade={selected ? 9 : 6}
                        numberOfLines={1}
                      >
                        {icon.label}
                      </Text>
                    </VStack>
                    <PressableFeedback.Highlight className="rounded-2xl" />
                  </PressableFeedback>
                </GridItem>
              );
            })}
          </Grid>
        </Box>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default AppIconScreen;

interface AppIconRestartDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function AppIconRestartDialog({ isOpen, onOpenChange, onConfirm }: AppIconRestartDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>앱 아이콘 변경</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>아이콘을 변경하면 앱이 재시작됩니다.</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          취소
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={onConfirm}>변경</ConfirmDialog.ConfirmButton>
      }
    />
  );
}

interface AppIconErrorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function AppIconErrorDialog({ isOpen, onOpenChange }: AppIconErrorDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>아이콘 변경 실패</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>
          앱 아이콘을 변경할 수 없습니다. 앱을 삭제 후 다시 설치하거나, 실기기에서 시도해 주세요.
        </ConfirmDialog.Description>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={() => onOpenChange(false)}>
          확인
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
