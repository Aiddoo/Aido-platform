import { createRuleTester } from '../rule-tester.mjs';
import rules from './model.mjs';

const tester = createRuleTester();

const MODEL = `type TodoCategory = z.infer<typeof todoCategorySchema>;
type CategoryState = { kind: 'idle' } | { kind: 'saving'; category: TodoCategory };
`;

tester.run('policy-facade', rules['policy-facade'], {
  valid: [
    `${MODEL}function canDelete(category: TodoCategory) { return !category.isDefault; }
function canReorder(categories: readonly TodoCategory[]) { return categories.length > 1; }
function canSave(state: CategoryState) { return state.kind === 'idle'; }
export const TodoCategoryPolicy = { canDelete, canReorder, canSave } as const;`,
    `function canEdit<T extends TodoCategory>(category: T) { return true; }
type TodoCategory = z.infer<typeof todoCategorySchema>;
export const TodoCategoryPolicy = { canEdit };`,
  ],
  invalid: [
    {
      code: `function canDelete(category) { return true; }
export const TodoCategoryPolicy = { canRemove: canDelete };`,
      errors: [{ message: /별칭\(canRemove: canDelete\)/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { canDelete: (category) => true };',
      errors: [{ message: /함수를 Facade 안에 정의했습니다/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { canDelete(category) { return true; } };',
      errors: [{ message: /메서드를 Facade 안에 정의했습니다/ }],
    },
    {
      code: `${MODEL}function canDelete(category: Pick<TodoCategory, 'isDefault'>) { return true; }
export const TodoCategoryPolicy = { canDelete };`,
      errors: [{ message: /모델 일부\(Pick<…>\)/ }],
    },
    {
      code: `function canDelete({ isDefault }) { return !isDefault; }
export const TodoCategoryPolicy = { canDelete };`,
      errors: [{ message: /구조 분해한 객체/ }],
    },
    {
      code: `type CategoryFlags = { isDefault: boolean };
function canDelete(category: CategoryFlags) { return true; }
export const TodoCategoryPolicy = { canDelete };`,
      errors: [{ message: /CategoryFlags\(객체 리터럴 타입\)/ }],
    },
    {
      code: `function canDelete<T extends { isDefault: boolean }>(category: T) { return true; }
export const TodoCategoryPolicy = { canDelete };`,
      errors: [{ message: /객체 리터럴 타입/ }],
    },
    {
      code: `${MODEL}function canDelete(id: TodoCategory['id']) { return true; }
export const TodoCategoryPolicy = { canDelete };`,
      errors: [{ message: /모델 필드 타입/ }],
    },
    {
      code: `${MODEL}function canDelete(category: TodoCategory & { extra: true }) { return true; }
export const TodoCategoryPolicy = { canDelete };`,
      errors: [{ message: /교차 타입/ }],
    },
  ],
});

tester.run('model-exports', rules['model-exports'], {
  valid: [
    'export const todoSchema = z.object({});',
    'export const TodoPolicy = { canDelete } as const;',
    'export function canDelete() {}',
    'export type Todo = { id: string };',
    'const LIMIT = 3;',
  ],
  invalid: [{ code: 'export const TODO_LIMIT = 3;', errors: 1 }],
});

tester.run('no-this-outside-class', rules['no-this-outside-class'], {
  valid: ['class TodoMapper { map() { return this; } }'],
  invalid: [
    { code: 'export const TodoPolicy = { canDelete() { return this.canEdit(); } };', errors: 1 },
  ],
});

tester.run('no-clock-read', rules['no-clock-read'], {
  valid: [
    'function isExpired(record, now) { return record.expiresAt < now; }',
    'const parsed = new Date(value);',
    'const zoned = Temporal.Instant.from(value);',
  ],
  invalid: [
    { code: 'const now = Date.now();', errors: 1 },
    { code: 'function shouldShow(record, now = new Date()) { return now; }', errors: 1 },
    { code: 'const today = Temporal.Now.plainDateISO();', errors: 1 },
    { code: 'const startedAt = performance.now();', errors: 1 },
  ],
});
