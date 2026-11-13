import { createRuleTester } from '../rule-tester.mjs';
import rules from './react.mjs';

const tester = createRuleTester();

tester.run('tabs-label-text', rules['tabs-label-text'], {
  valid: [
    '<Tabs.Label><Text>오늘</Text></Tabs.Label>',
    '<Tabs.Label>\n  <Text>오늘</Text>\n</Tabs.Label>',
    '<Tabs.Trigger>오늘</Tabs.Trigger>',
  ],
  invalid: [
    { code: '<Tabs.Label>오늘</Tabs.Label>', errors: 1 },
    { code: '<Tabs.Label>{label}</Tabs.Label>', errors: 1 },
  ],
});

tester.run('menu-item-title-text', rules['menu-item-title-text'], {
  valid: [
    '<Menu.ItemTitle><Text>최신순</Text></Menu.ItemTitle>',
    '<Menu.ItemTitle>\n  <Text size="b2">{title}</Text>\n</Menu.ItemTitle>',
    '<Menu.Item>{title}</Menu.Item>',
  ],
  invalid: [
    { code: "<Menu.ItemTitle>{t('sort.latest')}</Menu.ItemTitle>", errors: 1 },
    { code: '<Menu.ItemTitle>최신순</Menu.ItemTitle>', errors: 1 },
  ],
});

tester.run('no-classname-concat', rules['no-classname-concat'], {
  valid: [
    '<View className="flex-1 px-4" />',
    "<View className={cn('flex-1', isActive && 'bg-accent')} />",
    "<Text className={cn(isDanger ? 'text-danger' : 'text-foreground')} />",
    '<View className={buttonVariants({ size })} />',
    '<View className={className} />',
    '<View className={`flex-1`} />',
    "<View className={className ?? 'flex-1'} />",
  ],
  invalid: [
    { code: '<View className={`flex-1 ${isActive ? "bg-accent" : ""}`} />', errors: 1 },
    { code: "<Text className={isDanger ? 'text-danger' : 'text-foreground'} />", errors: 1 },
    { code: "<View className={'px-4 ' + className} />", errors: 1 },
    { code: "<View className={isActive && 'bg-accent'} />", errors: 1 },
    { code: '<FlatList contentContainerClassName={`gap-2 ${extra}`} />', errors: 1 },
  ],
});

tester.run('shared-value-accessor', rules['shared-value-accessor'], {
  valid: [
    'const progress = useSharedValue(0);\nprogress.set(1);\nconst current = progress.get();',
    "const input = useRef(null);\ninput.current.value = '';",
    'const event = { value: 1 };\nevent.value;',
  ],
  invalid: [
    { code: 'const progress = useSharedValue(0);\nprogress.value = 1;', errors: 1 },
    {
      code: 'const blank = useDerivedValue(() => 1);\nconst style = useAnimatedStyle(() => ({ height: blank.value }));',
      errors: 1,
    },
    {
      code: 'function Widget({ progress }: { progress: SharedValue<number> }) { return progress.value; }',
      errors: 1,
    },
    {
      code: 'type Props = { scale: SharedValue<number> };\nfunction Icon(props: Props) { return props.scale.value; }',
      errors: 1,
    },
    {
      code: 'function run(progress: SharedValue<number>) { progress.value += 1; }',
      errors: 1,
    },
  ],
});

tester.run('no-render-call', rules['no-render-call'], {
  valid: ['<Stepper.Render step={step} />', 'render(<Screen />);'],
  invalid: [{ code: 'const node = stepper.Render({ step });', errors: 1 }],
});

tester.run('card-uses-heroui-card', rules['card-uses-heroui-card'], {
  valid: [
    "import { Card } from 'heroui-native';\nexport function TodoCard() { return <Card />; }",
    "import { Surface } from 'heroui-native';\nexport function SurfaceCard() { return <Surface />; }",
  ],
  invalid: [
    {
      code: "import { View } from 'react-native';\nexport function TodoCard() { return <View />; }",
      errors: 1,
    },
  ],
});

tester.run('no-route-id-props', rules['no-route-id-props'], {
  valid: [
    'type CommentRowProps = { comment: TodoComment };',
    'function toThread(todoId: string) { return todoId; }',
    'function useThread({ todoId }: { todoId: string }) { return todoId; }',
  ],
  invalid: [
    { code: 'type CommentRowProps = { todoId: string; comment: TodoComment };', errors: 1 },
    { code: 'interface ReplyListProps extends Base { rootId: string }', errors: 1 },
    { code: 'type ComposerProps = Base & { parentId?: string };', errors: 1 },
    {
      code: 'export function CommentRow({ commentId }: { commentId: string }) { return null; }',
      errors: 1,
    },
    {
      code: 'export const ReplyList = memo(({ threadId }: { threadId: string } & Base) => null);',
      errors: 1,
    },
    {
      code: 'export default function ({ anchorCommentId }: { anchorCommentId: string }) { return null; }',
      errors: 1,
    },
  ],
});
