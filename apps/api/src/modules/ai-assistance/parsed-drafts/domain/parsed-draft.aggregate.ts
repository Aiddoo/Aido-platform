import { AI_PARSE_LIMITS } from "@aido/api/vocabulary";

import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { ParsedDraftId } from "./parsed-draft-id.vo.js";
import type { ParsedTodo } from "./parsed-drafts.constants.js";
import { invalidParsedDraft } from "./parsed-drafts.errors.js";

type ParsedTodos<TTodo extends ParsedTodo> = readonly [TTodo, ...TTodo[]];

export interface ParsedDraftPrimitives<TTodo extends ParsedTodo> {
  readonly id: string;
  readonly todos: ParsedTodos<TTodo>;
  readonly omittedTodoCount: number;
  readonly hasAction: boolean;
}

interface ParsedDraftProps<TTodo extends ParsedTodo> {
  readonly todos: ParsedTodos<TTodo>;
  readonly omittedTodoCount: number;
  readonly hasAction: boolean;
}

interface CreateParsedDraftParams<TTodo extends ParsedTodo> {
  readonly todos: readonly TTodo[];
  /** 상한을 넘어 만들지 않은 할 일 수 */
  readonly omittedTodoCount: number;
  /** 실행할 할 일이 있었는지. 없으면 안내용 할 일 하나만 두고 사용량을 차감하지 않는다 */
  readonly hasAction: boolean;
}

/**
 * 글·메모를 AI가 할 일로 바꾼 초안 한 건. 저장하지 않고 응답에만 쓴다.
 * 할 일은 1개 이상 메모 상한 이하이고, 실행할 할 일이 없던 초안은 만들지 않은 할 일도 없다.
 */
export class ParsedDraft<TTodo extends ParsedTodo = ParsedTodo> extends AggregateRoot<
  ParsedDraftId,
  ParsedDraftProps<TTodo>
> {
  static create<TTodo extends ParsedTodo>(
    params: CreateParsedDraftParams<TTodo>,
  ): ParsedDraft<TTodo> {
    const [first, ...rest] = params.todos;
    const { omittedTodoCount, hasAction } = params;
    if (first == null || params.todos.length > AI_PARSE_LIMITS.MEMO_MAX_TODOS) {
      throw invalidParsedDraft("parsed draft must keep 1 to MEMO_MAX_TODOS todos");
    }
    if (!Number.isInteger(omittedTodoCount) || omittedTodoCount < 0) {
      throw invalidParsedDraft("omitted todo count must be a non-negative integer");
    }
    if (!hasAction && omittedTodoCount > 0) {
      throw invalidParsedDraft("draft without action cannot omit todos");
    }
    return new ParsedDraft(ParsedDraftId.generate(), {
      todos: [first, ...rest],
      omittedTodoCount,
      hasAction,
    });
  }

  get todos(): ParsedTodos<TTodo> {
    return this.props.todos;
  }

  get omittedTodoCount(): number {
    return this.props.omittedTodoCount;
  }

  /** 실행할 할 일이 있어 사용량을 차감하는 초안인지 */
  hasAction(): boolean {
    return this.props.hasAction;
  }

  toPrimitives(): ParsedDraftPrimitives<TTodo> {
    return { id: this.id.value, ...this.props };
  }
}
