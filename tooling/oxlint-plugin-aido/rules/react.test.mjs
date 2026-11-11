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

tester.run('spacing-props-with-classname', rules['spacing-props-with-classname'], {
  valid: ['<Box px={4} />', '<Box className="px-4" />', '<HStack gap={2} className="flex-1" />'],
  invalid: [{ code: '<Box px={4} className="flex-1" />', errors: 1 }],
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
