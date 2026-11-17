import { createRuleTester } from '../rule-tester.mjs';
import rules from './layers.mjs';

const tester = createRuleTester();

const MEMO_PROPS = 'interface MemoProps { readonly content: MemoContent; isPinned: boolean }\n';

tester.run('aggregate-shape', rules['aggregate-shape'], {
  valid: [
    `${MEMO_PROPS}export class Memo extends AggregateRoot<MemoId, MemoProps> {
  static create(params: CreateMemoParams): Memo { return new Memo(params.id, params.props); }
  static reconstitute(primitives: MemoPrimitives): Memo { return new Memo(primitives.id, primitives); }
  get content(): MemoContent { return this.props.content; }
  isPinned(): boolean { return this.props.isPinned; }
  changePinned(isPinned: boolean): boolean { return true; }
}`,
    `export interface DraftProps { readonly title: string }
export class Draft extends AggregateRoot<null, DraftProps> { static create(): Draft { return new Draft(null, { title: '' }); } }`,
    'class MemoContent extends ValueObject<string> { static of(value: string) {} get isEmpty() { return true; } }',
    {
      code: `interface TodoSeriesProps { readonly title: string }
class TodoSeries extends AggregateRoot<TodoSeriesId, TodoSeriesProps> { static generate() {} }`,
      options: [{ factories: ['create', 'generate', 'reconstitute'] }],
    },
  ],
  invalid: [
    {
      code: `${MEMO_PROPS}class Memo extends AggregateRoot<MemoId, MemoProps> { static of(value: string) {} }`,
      errors: [{ message: /Memo\.of: Aggregate의 static은 create·reconstitute뿐이다/ }],
    },
    {
      code: `${MEMO_PROPS}class Memo extends AggregateRoot<MemoId, MemoProps> { static readonly LIMIT = 3; static #helper() {} }`,
      errors: [{ message: /Memo\.LIMIT/ }, { message: /Memo\.#helper/ }],
    },
    {
      code: `${MEMO_PROPS}class Memo extends AggregateRoot<MemoId, MemoProps> { static { init(); } }`,
      errors: [{ message: /static 블록/ }],
    },
    {
      code: `${MEMO_PROPS}class Memo extends AggregateRoot<MemoId, MemoProps> { constructor(id: MemoId, props: MemoProps) { super(id, props); } }`,
      errors: [{ message: /생성자를 열지 않는다/ }],
    },
    {
      code: `${MEMO_PROPS}class Memo extends AggregateRoot<MemoId, MemoProps> { get isPinned(): boolean { return true; } }`,
      errors: [{ message: /Memo\.isPinned: 상태 질문은 getter가 아니라/ }],
    },
    {
      code: `${MEMO_PROPS}class Memo extends AggregateRoot<MemoId, MemoProps> { get pinned(): boolean { return true; } }`,
      errors: [{ message: /Memo\.pinned: 상태 질문은 getter가 아니라/ }],
    },
    {
      code: 'type MemoProps = { content: string };\nclass Memo extends AggregateRoot<MemoId, MemoProps> {}',
      errors: [{ message: /interface MemoProps로 선언/ }],
    },
    {
      code: 'interface MemoState { content: string }\nclass Memo extends AggregateRoot<MemoId, MemoState> {}',
      errors: [{ message: /interface MemoProps로 선언/ }],
    },
    {
      code: 'class Memo extends AggregateRoot<MemoId, { content: string }> {}',
      errors: [{ message: /interface MemoProps로 선언/ }],
    },
    {
      code: "import type { MemoProps } from './memo-props.js';\nclass Memo extends AggregateRoot<MemoId, MemoProps> {}",
      errors: [{ message: /같은 파일의 interface MemoProps/ }],
    },
  ],
});

tester.run('use-case-single-execute', rules['use-case-single-execute'], {
  valid: [
    `export class CreateMemoUseCase {
  readonly #dependencies: CreateMemoDependencies;
  constructor(dependencies: CreateMemoDependencies) { this.#dependencies = dependencies; }
  async execute(command: CreateMemoCommand): Promise<Memo> { return this.#create(command); }
  async #create(command: CreateMemoCommand): Promise<Memo> {}
}`,
    'class MemoRepository { find() {} save() {} }',
  ],
  invalid: [
    {
      code: 'class CreateMemoUseCase { execute() {} executeForAdmin() {} }',
      errors: [
        { message: /CreateMemoUseCase\.executeForAdmin: UseCase의 공개 멤버는 execute 하나다/ },
      ],
    },
    {
      code: 'class ListMemosUseCase { execute() {} get size() { return 1; } readonly limit = 3; }',
      errors: [{ message: /ListMemosUseCase\.size/ }, { message: /ListMemosUseCase\.limit/ }],
    },
    {
      code: 'class SyncMemoUseCase { run() {} }',
      errors: [
        { message: /execute\(command\) 하나로 실행한다/ },
        { message: /SyncMemoUseCase\.run/ },
      ],
    },
    {
      code: 'class DeleteMemoUseCase { static execute() {} }',
      errors: [{ message: /execute\(command\) 하나로/ }, { message: /DeleteMemoUseCase\.execute/ }],
    },
  ],
});

const PORT_FILENAME = 'memo.repository.port.ts';

tester.run('port-id-value-object', rules['port-id-value-object'], {
  valid: [
    {
      code: `export abstract class MemoRepositoryPort {
  abstract findByIdAndUserId(memoId: MemoId, userId: UserId): Promise<Memo | null>;
  abstract findByIdempotencyKey(userId: UserId, idempotencyKey: string): Promise<Memo | null>;
  abstract listByUserId(params: { readonly userId: UserId; readonly limit: number }): Promise<Memo[]>;
  abstract findByIds(memoIds: readonly MemoId[]): Promise<Memo[]>;
}`,
      filename: PORT_FILENAME,
    },
    {
      code: 'export class InMemoryMemoRepository { find(memoId: number) {} }',
      filename: PORT_FILENAME,
    },
    {
      code: `export interface PublishedDomainEvent { readonly eventId: string }
export abstract class DomainEventPublisherPort { abstract publish(events: readonly PublishedDomainEvent[]): Promise<void>; }`,
      filename: PORT_FILENAME,
      options: [{ technicalIds: ['eventId'] }],
    },
  ],
  invalid: [
    {
      code: `export interface PublishedDomainEvent { readonly eventId: string; readonly userId: string }
export abstract class DomainEventPublisherPort { abstract publish(events: readonly PublishedDomainEvent[]): Promise<void>; }`,
      filename: PORT_FILENAME,
      options: [{ technicalIds: ['eventId'] }],
      errors: [{ message: /userId: 포트의 식별자는 원시값\(string\)/ }],
    },
    {
      code: 'export abstract class EmailSenderPort { abstract send(message: Email): Promise<{ readonly providerMessageId: string }>; }',
      filename: PORT_FILENAME,
      errors: [
        { message: /providerMessageId: .*공급자가 준 id도 slice domain의 공급자 이름 없는 VO/ },
      ],
    },
    {
      code: 'export abstract class MemoRepositoryPort { abstract findById(memoId: number): Promise<Memo | null>; }',
      filename: PORT_FILENAME,
      errors: [{ message: /memoId: 포트의 식별자는 원시값\(number\)이 아니라 id VO/ }],
    },
    {
      code: 'export abstract class MemoRepositoryPort { abstract delete(id: string | null): Promise<void>; }',
      filename: PORT_FILENAME,
      errors: [{ message: /id: 포트의 식별자는 원시값\(string\)/ }],
    },
    {
      code: 'export abstract class MemoRepositoryPort { abstract findByUserIds(userIds: readonly string[]): Promise<Memo[]>; }',
      filename: PORT_FILENAME,
      errors: [{ message: /userIds: 포트의 식별자는 원시값\(string\[\]\)/ }],
    },
    {
      code: 'export abstract class MemoRepositoryPort { abstract list(params: { readonly userId: string }): Promise<Memo[]>; }',
      filename: PORT_FILENAME,
      errors: [{ message: /userId: 포트의 식별자는 원시값\(string\)/ }],
    },
    {
      code: `export interface MemoSummary { readonly memoId: number; readonly title: string }
export abstract class MemoReaderPort {
  abstract findSummary(memoId: MemoId): Promise<MemoSummary | null>;
  abstract listSummaries(userId: UserId): Promise<readonly MemoSummary[]>;
}`,
      filename: PORT_FILENAME,
      errors: [{ message: /memoId: 포트의 식별자는 원시값\(number\)/ }],
    },
    {
      code: `type MemoTarget = { readonly ownerIds: ReadonlyArray<string> };
export abstract class MemoReaderPort { abstract list(): Promise<Map<UserId, MemoTarget>>; }`,
      filename: PORT_FILENAME,
      errors: [{ message: /ownerIds: 포트의 식별자는 원시값\(ReadonlyArray<string>\)/ }],
    },
  ],
});

tester.run('port-return-shape', rules['port-return-shape'], {
  valid: [
    {
      code: `type MemoPage = readonly Memo[];
export abstract class MemoRepositoryPort {
  abstract findById(memoId: MemoId): Promise<Memo | null>;
  abstract findByIds(memoIds: readonly MemoId[]): Promise<Memo[]>;
  abstract findCounts(userIds: readonly UserId[]): Promise<Map<UserId, number>>;
  abstract findRecent(userId: UserId): Promise<MemoPage>;
  abstract countByUserId(userId: UserId): Promise<number>;
}`,
      filename: PORT_FILENAME,
    },
    { code: 'export abstract class ClockPort { abstract findNow(): Temporal.Instant | null; }' },
  ],
  invalid: [
    {
      code: 'export abstract class MemoRepositoryPort { abstract findById(memoId: MemoId): Promise<Memo | undefined>; }',
      filename: PORT_FILENAME,
      errors: [{ message: /findById: find\*는 없을 때 null을 돌려준다/ }],
    },
    {
      code: 'export abstract class MemoCachePort { abstract find(key: string): Memo | null | undefined; }',
      filename: PORT_FILENAME,
      errors: [{ message: /find: find\*는 없을 때 null/ }],
    },
    {
      code: 'export abstract class MemoReaderPort { abstract findSummary(userId: UserId): Promise<MemoSummary>; }',
      filename: PORT_FILENAME,
      errors: [{ message: /findSummary: find\*는 T \| null을 돌려준다/ }],
    },
  ],
});
