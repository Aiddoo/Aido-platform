import { createRuleTester } from '../rule-tester.mjs';
import rules from './spacing.mjs';

const tester = createRuleTester();

tester.run('spacing-props-with-classname', rules['spacing-props-with-classname'], {
  valid: ['<Box px={4} />', '<Box className="px-4" />', '<HStack gap={2} className="flex-1" />'],
  invalid: [{ code: '<Box px={4} className="flex-1" />', errors: 1 }],
});

tester.run('spacing-scale', rules['spacing-scale'], {
  valid: [
    '<Spacing size={16} />',
    '<HStack gap={8} px={20} />',
    '<Box mt={-4} />',
    '<Grid rowGap={12} columnGap={12} />',
    '<HStack gap={isCompact ? 12 : 20} />',
    'const CARD_GAP = 12;\nconst view = <VStack gap={CARD_GAP} />;',
    '<Box gap={gap} />',
    '<Box width={10} />',
    '<Icon size={14} />',
    { code: '<Box gap={10} />', options: [{ allowed: [10] }] },
  ],
  invalid: [
    { code: '<Spacing size={14} />', errors: 1 },
    { code: '<HStack gap={10} />', errors: 1 },
    { code: '<Box px={18} />', errors: 1 },
    { code: '<Box mt={-3} />', errors: 1 },
    { code: '<Grid columnGap={10} />', errors: 1 },
    { code: '<HStack gap={isCompact ? 10 : 20} />', errors: 1 },
    { code: 'const view = <VStack gap={HEADER_GAP} />;\nconst HEADER_GAP = 14;', errors: 1 },
    { code: '<Box gap={10} />', options: [{ allowed: [8, 12] }], errors: 1 },
  ],
});

tester.run('no-arbitrary-spacing-class', rules['no-arbitrary-spacing-class'], {
  valid: [
    '<View className="px-4.5 gap-0.5" />',
    '<View className="absolute top-[8px] size-[15px] h-[32px]" />',
    '<View className="px-[var(--gutter)]" />',
    "const label = '여백 18px';",
  ],
  invalid: [
    {
      code: '<View className="px-[18px]" />',
      errors: [{ message: /같은 값 토큰으로 바꾸세요: px-4\.5/u }],
    },
    { code: '<View className="flex-row gap-[3px] pl-[7px] pr-[9px]" />', errors: 3 },
    {
      code: '<View className="-ml-[7.5px]" />',
      errors: [{ message: /7\.5px와 같은 토큰이 없습니다/u }],
    },
    { code: "<View className={cn('pb-[18px]', isActive && 'bg-accent')} />", errors: 1 },
    { code: '<FlatList contentContainerClassName="pt-[22px]" />', errors: 1 },
    { code: "const card = tv({ base: 'dark:mt-[9px]' });", errors: 1 },
    { code: 'const inset = `pt-[22px] ${extra}`;', errors: 1 },
  ],
});

tester.run('one-spacing-notation', rules['one-spacing-notation'], {
  valid: [
    '<VStack gap={8}><HStack px={16} /><Box py={8} /></VStack>',
    '<VStack><View className="px-4" /><View className="py-2" /></VStack>',
    '<VStack className="gap-2"><HStack px={16} /></VStack>',
    '<VStack><HStack gap={8} className="px-4" /></VStack>',
    '<><VStack><Box px={16} /></VStack><VStack><View className="px-4" /></VStack></>',
    '<VStack><Box px={16} /><Spacing size={8} /><View className="flex-1 bg-gray-1" /></VStack>',
    '<VStack><Box px={16} /><FlatList contentContainerClassName="px-4" /></VStack>',
    '<VStack><Box px={16} /><View className="mx-auto pb-safe" /></VStack>',
    '<Card icon={<><Box px={16} /></>}><View className="px-4" /></Card>',
    {
      code: 'import { Card } from \'heroui-native\';\nconst view = <VStack><Box px={16} /><Card className="p-4" /></VStack>;',
      options: [{ ignoreClassNameFrom: ['heroui-native'] }],
    },
  ],
  invalid: [
    {
      code: '<VStack><HStack px={16} /><View className="px-4" /></VStack>',
      errors: [
        {
          message:
            /<VStack>의 자식들이 여백 표기를 섞습니다: 레이아웃 prop\(px=\{16\}\), className 클래스\(px-4\)/u,
        },
      ],
    },
    {
      code: '<VStack><Box px={16} /><View className="px-4" /><Text className="mt-2" /></VStack>',
      errors: [{ message: /prop 자식 1개, 클래스 자식 2개/u }],
    },
    { code: '<VStack><Box px={16} />{isOpen && <Text className="mt-2" />}</VStack>', errors: 1 },
    { code: '<VStack><Box px={16} /><><Text className="mt-2" /></></VStack>', errors: 1 },
    {
      code: '<VStack><Box px={16} />{isOpen ? <Text className="mt-2" /> : null}</VStack>',
      errors: 1,
    },
    { code: 'const view = <><Box px={16} /><View className="px-4" /></>;', errors: 1 },
    { code: '<VStack><HStack gap={8} className="px-4" /><Box py={8} /></VStack>', errors: 1 },
    {
      code: "<VStack><HStack gap={8} /><Text className={cn('mt-2', isActive && 'text-main')} /></VStack>",
      errors: 1,
    },
    {
      code: '<VStack><Box px={16} /><View className="px-4" /><HStack><Box py={8} /><Text className="mt-1" /></HStack></VStack>',
      errors: 2,
    },
    {
      code: 'import { Card } from \'heroui-native\';\nconst view = <VStack><Box px={16} /><Card className="p-4" /></VStack>;',
      errors: 1,
    },
  ],
});
