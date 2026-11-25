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
    'export function CommentList() { return null; }\ninterface CommentListProps { comment: TodoComment }',
    'function toThread(todoId: string) { return todoId; }',
    'export function useThread({ todoId }: { todoId: string }) { return todoId; }',
    'export function CommentRow({ todoId }: { todoId: number }) { return null; }',
    'export function FriendItem(props: FriendItemProps) { return null; }\ninterface FriendItemProps { friendId: string }',
    'TodoDetail.Contents = function Contents({ todoId }: { todoId: number }) { return null; };',
    'function RemoveRecordingButton({ draftId }: { draftId?: string }) { return null; }',
    'interface UndoableProps { importId: string }\nexport function LastImport() { return null; }',
  ],
  invalid: [
    {
      code: 'export function CommentThread(props: CommentThreadProps) { return null; }\ntype CommentThreadProps = { todoId: string; comment: TodoComment };',
      errors: 1,
    },
    {
      code: 'export function ReplyList(props: ReplyListProps) { return null; }\ninterface ReplyListProps extends Base { rootId: string }',
      errors: 1,
    },
    {
      code: 'export function Composer(props: ComposerProps) { return null; }\ntype ComposerProps = Base & { parentId?: string };',
      errors: 1,
    },
    {
      code: 'export function CommentCard({ commentId }: { commentId: string }) { return null; }',
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
    {
      code: 'export function FriendCalendar(props: FriendCalendarProps) { return null; }\ninterface FriendCalendarProps { friendId: string }',
      errors: 1,
    },
    {
      code: 'export function MemoConvertBottomSheet({ categoryId }: { categoryId: number }) { return null; }',
      errors: 1,
    },
  ],
});

tester.run('error-boundary-fallback', rules['error-boundary-fallback'], {
  valid: [
    '<QueryErrorBoundary fallback={TodoList.Error}><TodoList /></QueryErrorBoundary>;',
    '<QueryErrorBoundary fallback={QueryErrorFallback.Hidden}><PlanTypeValue /></QueryErrorBoundary>;',
    '<QueryErrorBoundary><TodoList /></QueryErrorBoundary>;',
    '<Suspense fallback={<TodoList.Loading />}><TodoList /></Suspense>;',
    '<ErrorBoundary fallback={() => null}><TodoList /></ErrorBoundary>;',
  ],
  invalid: [
    {
      code: '<QueryErrorBoundary fallback={() => null}><Badge /></QueryErrorBoundary>;',
      errors: 1,
    },
    {
      code: '<QueryErrorBoundary fallback={(props) => <Steps.Error {...props} progress={progress} />}><Steps /></QueryErrorBoundary>;',
      errors: 1,
    },
    {
      code: '<QueryErrorBoundary fallback={function Fallback() { return null; }}><Badge /></QueryErrorBoundary>;',
      errors: 1,
    },
  ],
});

tester.run('props-interface', rules['props-interface'], {
  valid: [
    'interface TodoRowProps { todo: Todo }',
    'type TodoRowProps = Omit<ComponentProps<typeof Row>, "children">;',
    'type TodoRowProps = BaseProps & { todo: Todo };',
    'type Palette = { background: string };',
    'type StepContexts = { permission: Record<string, never> };',
  ],
  invalid: [
    { code: 'type GustLayerProps = { width: number; height: number };', errors: 1 },
    { code: 'export type ReleaseRowProps = { release: Release };', errors: 1 },
  ],
});

tester.run('forward-on-press', rules['forward-on-press'], {
  valid: [
    'function Card({ onPress, ...props }) { const handlePress = (event) => { open(); onPress?.(event); }; return <Pressable {...props} onPress={handlePress} />; }',
    'function Card({ onPress, ...props }) { return <Pressable {...props} onPress={onPress} />; }',
    'function Card(props) { return <Pressable {...props} onPress={(event) => { open(); props.onPress?.(event); }} />; }',
    'function Card(props) { const { onPress } = props; return <Pressable {...props} onPress={() => { open(); onPress?.(); }} />; }',
    'function Card({ label }) { return <Pressable onPress={open}>{label}</Pressable>; }',
    'function Card({ label, ...props }) { return <Pressable onPress={open} {...props} />; }',
    'function List({ items }) { const itemProps = getItemProps(); return <Row {...itemProps} onPress={open} />; }',
    'function Card({ ...props }) { return <Pressable {...props} onLongPress={open} />; }',
  ],
  invalid: [
    {
      code: 'function Card({ plan, ...props }) { return <Pressable {...props} onPress={handlePress} />; }',
      errors: [{ message: /밖에서 받은 onPress를 덮습니다/ }],
    },
    {
      code: 'function Card(props) { return <Pressable {...props} onPress={() => open()} />; }',
      errors: 1,
    },
    {
      code: 'List.Item = function Item({ id, ...rest }) { return <Row {...rest} onPress={() => open(id)} />; };',
      errors: 1,
    },
    {
      code: 'const Card = ({ plan, ...props }) => <Pressable {...props} variant="weak" onPress={open} />;',
      errors: 1,
    },
  ],
});
