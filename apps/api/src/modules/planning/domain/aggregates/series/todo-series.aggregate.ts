import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";

import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import {
  TodoSeriesEndedEvent,
  TodoSeriesStartedEvent,
} from "../../events/series/todo-series.events.js";
import type { RepeatRule } from "../../value-objects/series/repeat-rule.vo.js";
import { TodoTitle } from "../../value-objects/todos/todo-title.vo.js";
import type { TodoCreationDraft } from "../todos/todo.aggregate.js";

export interface ChecklistTemplateItem {
  readonly title: string;
}

export interface TodoSeriesProps {
  id: string;
  userId: string;
  categoryId: number;
  title: string;
  visibility: TodoVisibility;
  scheduledLocalTime: string | null;
  timezone: string;
  rule: RepeatRule;
  startDate: string;
  checklistTemplate: readonly ChecklistTemplateItem[];
  sortOrder: number;
  nextOccurrenceDate: string | null;
  generatedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoSeriesStartInput {
  readonly id: string;
  readonly userId: string;
  readonly categoryId: number;
  readonly title: string;
  readonly visibility: TodoVisibility;
  readonly scheduledLocalTime: string | null;
  readonly timezone: string;
  readonly rule: RepeatRule;
  readonly startDate: string;
  readonly checklistTemplate: readonly ChecklistTemplateItem[];
  readonly sortOrder: number;
  readonly at: Date;
}

export interface TodoSeriesChanges {
  readonly title?: string;
  readonly categoryId?: number;
  readonly visibility?: TodoVisibility;
  readonly scheduledLocalTime?: string | null;
  readonly checklistTemplate?: readonly ChecklistTemplateItem[];
  readonly rule?: RepeatRule;
}

/** 회차 한 행의 초안. sortOrder는 저장 직전 사용자 최대값 뒤로 붙인다. */
export interface TodoOccurrenceDraft extends TodoCreationDraft {
  readonly occurrenceDate: string;
  readonly createdAt: Date;
}

export class TodoSeries extends AggregateRoot<TodoSeriesProps> {
  private constructor(props: TodoSeriesProps) {
    super(props);
  }

  static reconstitute(props: TodoSeriesProps): TodoSeries {
    return new TodoSeries({
      ...props,
      checklistTemplate: props.checklistTemplate.map((item) => ({ title: item.title })),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  /** DB에 저장하기 전 새 규칙. 만들 수 있는 회차가 없으면 TODO_0843이다. */
  static planCreation(input: TodoSeriesStartInput): TodoSeries {
    TodoTitle.create(input.title);
    TodoSeries.#assertChecklist(input.checklistTemplate);
    const first = input.rule.firstOnOrAfter(input.startDate, input.startDate);
    if (first == null) {
      throw new DomainException(ErrorCode.TODO_0843, {
        startDate: input.startDate,
        repeat: input.rule.toSpec(),
      });
    }
    const series = new TodoSeries({
      id: input.id,
      userId: input.userId,
      categoryId: input.categoryId,
      title: input.title,
      visibility: input.visibility,
      scheduledLocalTime: input.scheduledLocalTime,
      timezone: input.timezone,
      rule: input.rule,
      startDate: input.startDate,
      checklistTemplate: input.checklistTemplate.map((item) => ({ title: item.title })),
      sortOrder: input.sortOrder,
      nextOccurrenceDate: first,
      generatedCount: 0,
      createdAt: new Date(input.at),
      updatedAt: new Date(input.at),
    });
    series.raise(new TodoSeriesStartedEvent(input.id, input.userId));
    return series;
  }

  static #assertChecklist(items: readonly ChecklistTemplateItem[]): void {
    if (items.length > TODO_ITEM_LIMITS.MAX_PER_TODO) {
      throw new DomainException(ErrorCode.TODO_0821, {
        currentCount: items.length,
        maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
      });
    }
  }

  /**
   * 다음 회차부터 through(포함)까지의 초안을 만들고 커서를 그 뒤로 옮긴다.
   * limit을 넘는 회차는 커서에 남아 다음 실행이 이어서 만든다.
   */
  planOccurrences(through: string, limit = Number.POSITIVE_INFINITY): TodoOccurrenceDraft[] {
    const { nextOccurrenceDate, rule, startDate, generatedCount } = this.props;
    if (nextOccurrenceDate == null) {
      return [];
    }
    const dates = rule
      .occurrencesBetween(startDate, nextOccurrenceDate, through, generatedCount)
      .slice(0, limit);
    const last = dates.at(-1);
    if (last == null) {
      return [];
    }
    this.props.generatedCount = generatedCount + dates.length;
    this.props.nextOccurrenceDate = rule.firstOnOrAfter(
      startDate,
      addDaysToDateKey(last, 1),
      this.props.generatedCount,
    );
    return dates.map((date) => this.#draftOn(date));
  }

  #draftOn(date: string): TodoOccurrenceDraft {
    const { userId, categoryId, title, scheduledLocalTime, timezone, visibility } = this.props;
    return {
      userId,
      categoryId,
      title,
      visibility,
      startDate: parseDateOnly(date),
      endDate: null,
      // DST로 오프셋이 달라지므로 회차 날짜마다 규칙 시간대로 다시 해석한다.
      scheduledTime:
        scheduledLocalTime == null ? null : parseLocalDateTime(date, scheduledLocalTime, timezone),
      isAllDay: scheduledLocalTime == null,
      occurrenceDate: date,
      // 리텐션·성장 지표가 createdAt을 사용자 행동으로 쓰므로 규칙을 만든 시각을 물려받는다.
      createdAt: new Date(this.props.createdAt),
    };
  }

  /** date 뒤로 회차를 만들지 않는다. 더 끝낼 게 없으면 false다. */
  stopAfter(date: string): boolean {
    if (this.#isEndedAfter(date)) {
      return false;
    }
    const next = addDaysToDateKey(date, 1);
    this.props.rule = this.props.rule.endingBefore(next);
    this.props.nextOccurrenceDate = null;
    this.raise(new TodoSeriesEndedEvent(this.props.id, this.props.userId));
    return true;
  }

  #isEndedAfter(date: string): boolean {
    const { rule, startDate } = this.props;
    const next = addDaysToDateKey(date, 1);
    return rule.firstOnOrAfter(startDate, next, rule.countBefore(startDate, next)) == null;
  }

  /** pivotDate부터 새 규칙으로 잇고 이 규칙은 그 전날로 끝낸다. 만든 뒤의 회차 수는 0이다. */
  splitFrom(
    pivotDate: string,
    changes: TodoSeriesChanges,
    newId: string,
    sortOrder: number,
    at: Date,
  ): TodoSeries {
    const { title, categoryId, visibility, scheduledLocalTime, checklistTemplate } = this.props;
    const rule = changes.rule ?? this.props.rule.continuingFrom(this.props.startDate, pivotDate);
    const next = TodoSeries.planCreation({
      id: newId,
      userId: this.props.userId,
      categoryId: changes.categoryId ?? categoryId,
      title: changes.title ?? title,
      visibility: changes.visibility ?? visibility,
      // nullish-strict: null은 시간 지우기, undefined는 유지다
      scheduledLocalTime:
        changes.scheduledLocalTime === undefined ? scheduledLocalTime : changes.scheduledLocalTime,
      timezone: this.props.timezone,
      rule,
      startDate: pivotDate,
      checklistTemplate: changes.checklistTemplate ?? checklistTemplate,
      sortOrder,
      at,
    });
    this.stopAfter(addDaysToDateKey(pivotDate, -1));
    return next;
  }

  /** 규칙은 그대로 두고 제목·카테고리·공개·시간만 바꾼다. 바뀐 게 있으면 true다. */
  applyDetails(changes: Omit<TodoSeriesChanges, "rule" | "checklistTemplate">): boolean {
    let changed = false;
    if (changes.title != null && changes.title !== this.props.title) {
      TodoTitle.create(changes.title);
      this.props.title = changes.title;
      changed = true;
    }
    if (changes.categoryId != null && changes.categoryId !== this.props.categoryId) {
      this.props.categoryId = changes.categoryId;
      changed = true;
    }
    if (changes.visibility != null && changes.visibility !== this.props.visibility) {
      this.props.visibility = changes.visibility;
      changed = true;
    }
    // nullish-strict: null은 시간 지우기, undefined는 유지다
    if (
      changes.scheduledLocalTime !== undefined &&
      changes.scheduledLocalTime !== this.props.scheduledLocalTime
    ) {
      this.props.scheduledLocalTime = changes.scheduledLocalTime;
      changed = true;
    }
    return changed;
  }

  /** 다른 카테고리로 옮길 때 규칙도 함께 옮긴다. 이미 그 카테고리면 false다. */
  recategorize(categoryId: number): boolean {
    return this.applyDetails({ categoryId });
  }

  getId(): string {
    return this.props.id;
  }

  getUserId(): string {
    return this.props.userId;
  }

  getStartDate(): string {
    return this.props.startDate;
  }

  getRule(): RepeatRule {
    return this.props.rule;
  }

  getCategoryId(): number {
    return this.props.categoryId;
  }

  getTitle(): string {
    return this.props.title;
  }

  getVisibility(): TodoVisibility {
    return this.props.visibility;
  }

  getTimezone(): string {
    return this.props.timezone;
  }

  getScheduledLocalTime(): string | null {
    return this.props.scheduledLocalTime;
  }

  getChecklistTemplate(): ChecklistTemplateItem[] {
    return this.props.checklistTemplate.map((item) => ({ title: item.title }));
  }

  getNextOccurrenceDate(): string | null {
    return this.props.nextOccurrenceDate;
  }

  getGeneratedCount(): number {
    return this.props.generatedCount;
  }

  isActive(): boolean {
    return this.props.nextOccurrenceDate != null;
  }

  toPersistence(): Readonly<TodoSeriesProps> {
    return {
      ...this.props,
      checklistTemplate: this.getChecklistTemplate(),
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
    };
  }
}
