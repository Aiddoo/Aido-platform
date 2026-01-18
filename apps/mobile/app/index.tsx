import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'heroui-native';
import { ScrollView } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Uniwind, useUniwind, withUniwind } from 'uniwind';
import { Box } from '../core/component/ui/Box';
import { Flex } from '../core/component/ui/Flex';
import { HStack } from '../core/component/ui/HStack';
import { H1, Text } from '../core/component/ui/Text';
import { VStack } from '../core/component/ui/VStack';

const StyledIonicons = withUniwind(Ionicons);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack className="mb-6 rounded-2xl bg-surface p-4" gap={12}>
      <Text size="e1" tone="neutral" shade={6}>
        {title}
      </Text>
      {children}
    </VStack>
  );
}

export default function HomeScreen() {
  const { theme } = useUniwind();
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    Uniwind.setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <VStack className="px-6 py-8" gap={0}>
        {/* 테마 토글 */}
        <HStack className="mb-8" justify="center" align="center" gap={12}>
          <Text size="b3" tone="neutral" shade={6}>
            라이트
          </Text>
          <Switch
            isSelected={isDark}
            onSelectedChange={toggleTheme}
            className="h-[32px] w-[56px]"
            animation={{
              backgroundColor: {
                value: ['#E0E0E0', '#424242'],
              },
            }}
          >
            <Switch.Thumb
              className="size-[22px]"
              animation={{
                left: {
                  value: 4,
                  springConfig: { damping: 30, stiffness: 300, mass: 1 },
                },
              }}
            />
            <Switch.StartContent className="left-2">
              {isDark && (
                <Animated.View key="moon" entering={ZoomIn.springify()}>
                  <StyledIonicons name="moon" size={14} className="text-gray-9" />
                </Animated.View>
              )}
            </Switch.StartContent>
            <Switch.EndContent className="right-2">
              {!isDark && (
                <Animated.View key="sun" entering={ZoomIn.springify()}>
                  <StyledIonicons name="sunny" size={14} className="text-gray-8" />
                </Animated.View>
              )}
            </Switch.EndContent>
          </Switch>
          <Text size="b3" tone="neutral">
            다크
          </Text>
        </HStack>

        <H1 className="mb-6">UI 컴포넌트 테스트</H1>

        {/* HStack 테스트 */}
        <Section title="HStack (수평 정렬)">
          <HStack gap={8}>
            <Box className="h-12 w-12 rounded-lg bg-main" />
            <Box className="h-12 w-12 rounded-lg bg-main" />
            <Box className="h-12 w-12 rounded-lg bg-main" />
          </HStack>

          <Text size="e2" tone="neutral" shade={5}>
            justify="between"
          </Text>
          <HStack justify="between">
            <Box className="h-10 w-10 rounded-lg bg-info" />
            <Box className="h-10 w-10 rounded-lg bg-info" />
            <Box className="h-10 w-10 rounded-lg bg-info" />
          </HStack>

          <Text size="e2" tone="neutral" shade={5}>
            align="center" + gap
          </Text>
          <HStack align="center" gap={12} className="rounded-lg bg-gray-2 p-3">
            <Box className="size-8 rounded-full bg-success" />
            <VStack gap={2}>
              <Text weight="semibold">홍길동</Text>
              <Text size="e1" tone="neutral" shade={6}>
                개발자
              </Text>
            </VStack>
          </HStack>
        </Section>

        {/* VStack 테스트 */}
        <Section title="VStack (수직 정렬)">
          <VStack gap={8}>
            <Box className="h-10 w-full rounded-lg bg-warning" />
            <Box className="h-10 w-full rounded-lg bg-warning" />
            <Box className="h-10 w-full rounded-lg bg-warning" />
          </VStack>

          <Text size="e2" tone="neutral" shade={5}>
            align="center"
          </Text>
          <VStack align="center" gap={8}>
            <Box className="h-8 w-20 rounded-lg bg-error" />
            <Box className="h-8 w-16 rounded-lg bg-error" />
            <Box className="h-8 w-12 rounded-lg bg-error" />
          </VStack>
        </Section>

        {/* Flex 테스트 */}
        <Section title="Flex (방향 지정)">
          <Text size="e2" tone="neutral" shade={5}>
            direction="row" wrap="wrap"
          </Text>
          <Flex direction="row" wrap="wrap" gap={8}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Box key={i} className="size-14 rounded-lg bg-main" />
            ))}
          </Flex>

          <Text size="e2" tone="neutral" shade={5}>
            direction="column" align="end"
          </Text>
          <Flex direction="column" align="end" gap={4}>
            <Box className="h-8 w-24 rounded-lg bg-success" />
            <Box className="h-8 w-20 rounded-lg bg-success" />
            <Box className="h-8 w-16 rounded-lg bg-success" />
          </Flex>
        </Section>

        {/* Box 테스트 */}
        <Section title="Box (단순 컨테이너)">
          <Box className="rounded-xl bg-gray-3 p-4">
            <Text>Box는 단순 View 래퍼입니다</Text>
          </Box>

          <Box className="rounded-xl border border-main p-4">
            <VStack gap={8}>
              <Text weight="bold" tone="brand">
                중첩 사용 예시
              </Text>
              <HStack gap={8}>
                <Box className="size-10 rounded-lg bg-info" />
                <Box className="size-10 rounded-lg bg-warning" />
                <Box className="size-10 rounded-lg bg-success" />
              </HStack>
            </VStack>
          </Box>
        </Section>

        {/* 실제 사용 예시 */}
        <Section title="실제 사용 예시">
          {/* 카드 */}
          <Box className="rounded-2xl bg-gray-2 p-4">
            <HStack align="center" gap={12}>
              <Box className="size-12 rounded-full bg-main" />
              <VStack gap={2} className="flex-1">
                <Text weight="semibold">알림 제목</Text>
                <Text size="e1" tone="neutral" shade={6}>
                  알림 내용이 여기에 표시됩니다.
                </Text>
              </VStack>
              <Text size="e2" tone="neutral" shade={5}>
                방금
              </Text>
            </HStack>
          </Box>

          {/* 버튼 그룹 */}
          <HStack gap={8}>
            <Box className="flex-1 items-center rounded-xl bg-main py-3">
              <Text weight="semibold" className="text-white">
                확인
              </Text>
            </Box>
            <Box className="flex-1 items-center rounded-xl border border-gray-4 py-3">
              <Text weight="semibold" tone="neutral" shade={8}>
                취소
              </Text>
            </Box>
          </HStack>
        </Section>
      </VStack>
    </ScrollView>
  );
}
