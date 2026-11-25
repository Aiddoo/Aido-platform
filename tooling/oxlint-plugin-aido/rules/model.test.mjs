import { createRuleTester } from '../rule-tester.mjs';
import rules from './model.mjs';

const tester = createRuleTester();

const MODEL = `type TodoCategory = z.infer<typeof todoCategorySchema>;
type CategoryState = { kind: 'idle' } | { kind: 'saving'; category: TodoCategory };
`;

tester.run('policy-facade', rules['policy-facade'], {
  valid: [
    `${MODEL}export const TodoCategoryPolicy = {
  canDelete(category: TodoCategory): boolean { return !category.isDefault; },
  canReorder(categories: readonly TodoCategory[]): boolean { return categories.length > 1; },
  canSave(state: CategoryState): boolean { return state.kind === 'idle' && this.canReorder([]); },
};`,
    `type TodoCategory = z.infer<typeof todoCategorySchema>;
export const TodoCategoryPolicy = { canEdit<T extends TodoCategory>(category: T) { return true; } } as const;`,
    'const retryPolicy = { retries: 3 };',
    'export const todoSchema = z.object({});',
    'export const TodoCategoryPolicy = { countEditable(categories: readonly TodoCategory[]): number { return categories.filter((category) => this.canEdit(category)).length; } };',
  ],
  invalid: [
    {
      code: 'export const TodoCategoryPolicy = { canSave(category: TodoCategory) { return this.canEdit(category); } };',
      errors: [{ message: /TodoCategoryPolicy\.canSave: this로 다른 메서드를 부르면 반환 타입/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { countEditable(categories: readonly TodoCategory[]) { return categories.filter((category) => this.canEdit(category)).length; } };',
      errors: 1,
    },
    {
      code: `function canDelete(category) { return true; }
export const TodoCategoryPolicy = { canDelete } as const;`,
      errors: [{ message: /모듈 함수를 묶었습니다\(canDelete\)/ }],
    },
    {
      code: `function canDelete(category) { return true; }
export const TodoCategoryPolicy = { canRemove: canDelete };`,
      errors: [{ message: /별칭\(canRemove: canDelete\)/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { canDelete: (category) => true };',
      errors: [{ message: /함수 속성\(canDelete: …\)/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { canDelete: function canDelete(category) { return true; } };',
      errors: [{ message: /함수 속성/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { ...BasePolicy, canDelete(category) { return true; } };',
      errors: [{ message: /펼침/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { get limit() { return 3; } };',
      errors: [{ message: /접근자/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { limit: 3 };',
      errors: [{ message: /메서드가 아닌 값\(limit\)/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { [name](category) { return true; } };',
      errors: [{ message: /계산된 키/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = createPolicy();',
      errors: [{ message: /객체 리터럴/ }],
    },
    {
      code: `${MODEL}export const TodoCategoryPolicy = { canDelete(category: Pick<TodoCategory, 'isDefault'>) { return true; } };`,
      errors: [{ message: /모델 일부\(Pick<…>\)/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { canDelete({ isDefault }) { return !isDefault; } };',
      errors: [{ message: /구조 분해한 객체/ }],
    },
    {
      code: `type CategoryFlags = { isDefault: boolean };
export const TodoCategoryPolicy = { canDelete(category: CategoryFlags) { return true; } };`,
      errors: [{ message: /CategoryFlags\(객체 리터럴 타입\)/ }],
    },
    {
      code: 'export const TodoCategoryPolicy = { canDelete<T extends { isDefault: boolean }>(category: T) { return true; } };',
      errors: [{ message: /객체 리터럴 타입/ }],
    },
    {
      code: `${MODEL}export const TodoCategoryPolicy = { canDelete(id: TodoCategory['id']) { return true; } };`,
      errors: [{ message: /모델 필드 타입/ }],
    },
    {
      code: `${MODEL}export const TodoCategoryPolicy = { canDelete(category: TodoCategory & { extra: true }) { return true; } };`,
      errors: [{ message: /교차 타입/ }],
    },
  ],
});

const LOCAL_MODEL = `import type { Todo } from '../../todo/domains/todo.model';
export type TodoCategory = z.infer<typeof todoCategorySchema>;
interface TodoCategoryWithCount extends TodoCategory { todoCount: number }
`;

tester.run('policy-model-parameter', rules['policy-model-parameter'], {
  valid: [
    `${LOCAL_MODEL}export const TodoCategoryPolicy = { canDelete(category: TodoCategory) { return true; } };`,
    `${LOCAL_MODEL}export const TodoCategoryPolicy = { hasTodos(category: TodoCategoryWithCount) { return true; } };`,
    `${LOCAL_MODEL}export const TodoCategoryPolicy = { canReorder(categories: readonly TodoCategory[]) { return true; } };`,
    `${LOCAL_MODEL}export const TodoCategoryPolicy = { canReorder(categories: ReadonlyArray<TodoCategory>) { return true; } };`,
    `${LOCAL_MODEL}export const TodoCategoryPolicy = { findLatest(categories: readonly [TodoCategory, ...TodoCategory[]]) { return categories[0]; } };`,
    `${LOCAL_MODEL}export const TodoCategoryPolicy = { canRestore(category: TodoCategory | null) { return category != null; } };`,
    `${LOCAL_MODEL}export const TodoCategoryPolicy = { find<T extends TodoCategory>(categories: readonly T[], id: number) { return null; } };`,
    `${LOCAL_MODEL}export const TodoCategoryPolicy = { countAll({ todoCount }: TodoCategoryWithCount) { return todoCount; } } as const;`,
    'const handlers = { run(input: Other) {} };',
    'const TodoCategoryPolicy = { rules: { canDelete(input: Other) {} } };',
  ],
  invalid: [
    {
      code: `${LOCAL_MODEL}export const TodoCategoryPolicy = { canNudge(todo: Todo) { return true; } };`,
      errors: [{ message: /TodoCategoryPolicy\.canNudge: 첫 인자는 이 파일이 선언한 모델 전체/ }],
    },
    {
      code: `${LOCAL_MODEL}export const TodoCategoryPolicy = { isValidName(name: string) { return true; } };`,
      errors: 1,
    },
    {
      code: `${LOCAL_MODEL}export const TodoCategoryPolicy = { getFailureCause(error: unknown) { return null; } };`,
      errors: 1,
    },
    {
      code: `${LOCAL_MODEL}export const TodoCategoryPolicy = { getLimit() { return 3; } };`,
      errors: 1,
    },
    {
      code: `${LOCAL_MODEL}export const TodoCategoryPolicy = { find<T>(categories: readonly T[]) { return null; } };`,
      errors: 1,
    },
    {
      code: `${LOCAL_MODEL}export const TodoCategoryPolicy = { canMove(target: TodoCategory | Todo) { return true; } };`,
      errors: 1,
    },
    {
      code: `${LOCAL_MODEL}export const TodoCategoryPolicy = { findTodo(todos: readonly Todo[]) { return null; } };`,
      errors: 1,
    },
    {
      code: `${LOCAL_MODEL}export const TodoCategoryPolicy = { canDelete(category) { return true; } };`,
      errors: 1,
    },
  ],
});

tester.run('no-unbound-policy-method', rules['no-unbound-policy-method'], {
  valid: [
    'const unread = notifications.filter((notification) => NotificationPolicy.isUnread(notification));',
    'const canDelete = TodoPolicy.canDelete(todo);',
    'const canDelete = TodoPolicy.canDelete?.(todo);',
    'type CanDelete = typeof TodoPolicy.canDelete;',
    'type Result = ReturnType<typeof TodoPolicy.getStats>;',
    'const { retries } = retryPolicy;',
    'const run = handlers.run;',
    "jest.spyOn(TodoPolicy, 'canDelete');",
  ],
  invalid: [
    {
      code: 'const unread = notifications.filter(NotificationPolicy.isUnread);',
      errors: [{ message: /NotificationPolicy\.isUnread를 호출 없이 값으로/ }],
    },
    { code: 'const canDelete = TodoPolicy.canDelete;', errors: 1 },
    { code: 'const { canDelete } = TodoPolicy;', errors: [{ message: /구조 분해/ }] },
    { code: 'let canDelete; ({ canDelete } = TodoPolicy);', errors: 1 },
    { code: 'const options = { select: EntitlementPolicy.hasFullAccess };', errors: 1 },
    { code: 'const orders = [TodoPolicy.orderByDate, TodoPolicy.orderByTitle];', errors: 2 },
    { code: 'const bound = TodoPolicy.canDelete.bind(TodoPolicy);', errors: 1 },
    { code: "const canDelete = TodoPolicy['canDelete'];", errors: 1 },
    { code: 'match(todo).when(TodoPolicy.isDone, () => 1);', errors: 1 },
  ],
});

tester.run('model-exports', rules['model-exports'], {
  valid: [
    'export const todoSchema = z.object({});',
    'export const TodoPolicy = { canDelete(todo: Todo) { return true; } };',
    'export function isValidTitle(title: string) {}',
    'export type Todo = { id: string };',
    'const LIMIT = 3;',
  ],
  invalid: [
    { code: 'export const TODO_LIMIT = 3;', errors: 1 },
    { code: 'export const todoPolicy = { canDelete() {} };', errors: 1 },
  ],
});

const MODEL_FILE = `import { todoRepeatSchema, type TodoRepeat } from './todo-repeat.model';
import { type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import { notificationTypeSchema } from '@aido/api/common';
export const todoSchema = z.object({ id: z.int(), startDate: dateKeySchema });
export type Todo = z.infer<typeof todoSchema>;
const todoDetailsSchema = todoSchema.extend({ memo: z.string() });
type TodoDetails = z.infer<typeof todoDetailsSchema>;
const presetSchema = z.enum(['week', 'month']);
type Preset = z.infer<typeof presetSchema>;
type Visibility = 'PUBLIC' | 'PRIVATE';
type NotificationType = z.infer<typeof notificationTypeSchema>;
type TodoSpan = Pick<Todo, 'startDate'>;
type TodoResult = z.infer<typeof todoResultSchema>;
const todoResultSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('ok') })]);
const tagSchema = z.string().brand<'Tag'>();
type Tag = z.infer<typeof tagSchema>;
const optionalDateSchema = dateKeySchema.nullable();
type OptionalDate = z.infer<typeof optionalDateSchema>;
type Repeat = z.infer<typeof todoRepeatSchema>;
interface RetryInput { attempt: number; retryAfterMs: number | null; random: () => number }
interface EditInput { repeat: TodoRepeat; isSeries: boolean }
`;

tester.run('model-function-exports', rules['model-function-exports'], {
  valid: [
    `${MODEL_FILE}export function calculateEndDate(startDate: DateKey, days: number): DateKey { return startDate; }`,
    `${MODEL_FILE}export function isWithinHorizon(date: DateKey | null, horizonDays: number | null) { return true; }`,
    `${MODEL_FILE}export function createTodo(details: TodoDetails): Todo { return details; }`,
    `${MODEL_FILE}export function getPresetDays(preset: Preset) { return 7; }`,
    `${MODEL_FILE}export function isPrivate(visibility: Visibility | null) { return false; }`,
    `${MODEL_FILE}export function isAiFeature(type: NotificationType) { return false; }`,
    `${MODEL_FILE}export function getVisibility(visibility: Todo['visibility'] | null) { return visibility; }`,
    `${MODEL_FILE}export function isValidTag(tag: Tag, others: readonly Tag[]) { return true; }`,
    `${MODEL_FILE}export function hasDate(date: OptionalDate) { return date != null; }`,
    `${MODEL_FILE}export function getRetryDelayMs({ attempt, retryAfterMs, random }: RetryInput) { return 0; }`,
    `${MODEL_FILE}export function findConsent({ agreedAt }: { agreedAt: Instant | null }) { return null; }`,
    `${MODEL_FILE}export function countUnique(ids: readonly string[]) { return 0; }`,
    `${MODEL_FILE}export function findFirst<T>(items: readonly T[]) { return items[0] ?? null; }`,
    `${MODEL_FILE}export function getLatestTourReleaseId() { return 1; }`,
    `${MODEL_FILE}export function parseCode(raw: unknown) { return null; }`,
    `${MODEL_FILE}export function getPage(page = 1) { return page; }`,
    `${MODEL_FILE}export function pageSchema<TItem extends z.ZodType>(item: TItem) { return z.object({ items: z.array(item) }); }`,
    `${MODEL_FILE}function isOptimistic(todo: Todo) { return todo.id < 0; }`,
    `${MODEL_FILE}export const TodoPolicy = { isOptimistic(todo: Todo) { return todo.id < 0; } };`,
  ],
  invalid: [
    {
      code: `${MODEL_FILE}export function isOptimistic(todo: Todo) { return todo.id < 0; }`,
      errors: [{ message: /isOptimistic: 모델을 첫 인자로 받는 함수/ }],
    },
    {
      code: `${MODEL_FILE}export function findTodo(todos: readonly Todo[], id: number) { return null; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function hasMemo(details: TodoDetails | null) { return false; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function getDateSpan(todo: TodoSpan) { return 1; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function getDateSpan(todo: Pick<Todo, 'startDate'>) { return 1; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function isOk(result: TodoResult) { return true; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function getRepeatKind(repeat: TodoRepeat) { return 'none'; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function getRepeatKind(repeat: Repeat) { return 'none'; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function getScopeDecision({ repeat, isSeries }: EditInput) { return null; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function withToggled<T extends Todo>(todo: T): T { return todo; }`,
      errors: 1,
    },
    {
      code: `${MODEL_FILE}export function toAvailability(result: Result<Todo, Error>) { return null; }`,
      errors: 1,
    },
  ],
});

tester.run('no-this-outside-class', rules['no-this-outside-class'], {
  valid: [
    'class TodoMapper { map() { return this; } }',
    'class TodoStore { load = () => this.items; }',
    'export const TodoPolicy = { canDelete(todo) { return this.canEdit(todo); } };',
    'export const TodoPolicy = { countEditable(todos) { return todos.filter((todo) => this.canEdit(todo)).length; } } as const;',
  ],
  invalid: [
    { code: 'function canDelete(todo) { return this.canEdit(todo); }', errors: 1 },
    { code: 'const handlers = { run() { return this.stop(); } };', errors: 1 },
    { code: 'const todoPolicy = { canDelete(todo) { return this.canEdit(todo); } };', errors: 1 },
    {
      code: 'export const TodoPolicy = { countEditable(todos) { return todos.filter(function isEditable(todo) { return this.canEdit(todo); }).length; } };',
      errors: 1,
    },
    {
      code: 'export const TodoPolicy = { rules: { canDelete(todo) { return this.canEdit(todo); } } };',
      errors: 1,
    },
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
