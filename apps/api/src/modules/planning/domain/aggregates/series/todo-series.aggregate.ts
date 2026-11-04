import { ErrorCode } from "@aido/api/errors";
import { RECURRING_TODO_LIMITS, TODO_ITEM_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";
import { isEqual } from "es-toolkit";

import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { localDateInTimezone, parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import type { RepeatRule } from "../../value-objects/series/repeat-rule.vo.js";
import { TodoTitle } from "../../value-objects/todos/todo-title.vo.js";
import type { TodoCreationDraft } from "../todos/todo.aggregate.js";

/**
 * 새 규칙이 만들 수 있는 지난 회차 상한. 아주 먼 과거에서 시작하면 요청 안에서 수백 행이 지난 미완료로
 * 쌓인다. 출시 앱의 /recurring은 366일 안의 날짜만 보내므로 이 상한에 닿지 않는다.
 */
const MAX_PAST_OCCURRENCES_ON_START = RECURRING_TODO_LIMITS.MAX_DAYS_RANGE;

export interface ChecklistTemplateItem {
  readonly title: string;
}

export interface TodoSeriesProps {
  id: string;
  /** 분할 전 맨 처음 규칙의 id. 분할된 구간을 한 쿼리로 묶는다. 처음 규칙은 자기 id다. */
  originSeriesId: string;
  userId: string;
  categoryId: number;
  title: string;
  visibility: TodoVisibility;
  scheduledLocalTime: string | null;
  timezone: string;
  rule: RepeatRule;
  startDate: string;
  checklistTemplate: readonly ChecklistTemplateItem[];
  nextOccurrenceDate: string | null;
  generatedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoSeriesStartInput {
  readonly id: string;
  /** 분할로 이어지는 규칙만 넘긴다. 없으면 이 규칙이 원본이다. */
  readonly originSeriesId?: string;
  readonly userId: string;
  readonly categoryId: number;
  readonly title: string;
  readonly visibility: TodoVisibility;
  readonly scheduledLocalTime: string | null;
  readonly timezone: string;
  readonly rule: RepeatRule;
  readonly startDate: string;
  readonly checklistTemplate: readonly ChecklistTemplateItem[];
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
    return new TodoSeries({
      id: input.id,
      originSeriesId: input.originSeriesId ?? input.id,
      userId: input.userId,
      categoryId: input.categoryId,
      title: input.title,
      visibility: input.visibility,
      scheduledLocalTime: input.scheduledLocalTime,
      timezone: input.timezone,
      rule: input.rule,
      startDate: input.startDate,
      checklistTemplate: input.checklistTemplate.map((item) => ({ title: item.title })),
      nextOccurrenceDate: first,
      generatedCount: 0,
      createdAt: new Date(input.at),
      updatedAt: new Date(input.at),
    });
  }

  /** 새로 시작하는 규칙만 확인한다. 분할은 이미 있던 규칙을 잇는 것이라 지난 회차 수와 상관없다. */
  assertWithinPastLimit(at: Date): void {
    const { rule, startDate, timezone } = this.props;
    if (
      rule.countBefore(startDate, localDateInTimezone(at, timezone)) > MAX_PAST_OCCURRENCES_ON_START
    ) {
      throw new DomainException(ErrorCode.TODO_0845, { field: "startDate" });
    }
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

  /**
   * 자리 비운 동안 멈춘 커서를 오늘 이후 첫 회차로 옮긴다. 지난 날은 만들지 않지만 COUNT는 달력으로 세어
   * 그 횟수의 날짜가 다 지났으면 끝난다. 채울 때마다 커서는 기간(90일)만큼 앞서므로 오늘보다 뒤처졌다면
   * 그만큼 채우지 못한 것이다. 규칙 행을 고쳤는지(updatedAt)는 채운 시점과 상관없어 보지 않는다.
   */
  skipDormantGap(at: Date): boolean {
    const { nextOccurrenceDate, generatedCount, rule, startDate, timezone } = this.props;
    const today = localDateInTimezone(at, timezone);
    if (nextOccurrenceDate == null || nextOccurrenceDate >= today) {
      return false;
    }
    this.props.generatedCount = Math.max(generatedCount, rule.countBefore(startDate, today));
    this.props.nextOccurrenceDate = rule.firstOnOrAfter(
      startDate,
      today,
      this.props.generatedCount,
    );
    return true;
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

  /**
   * date 뒤로 회차를 만들지 않는다. 더 끝낼 게 없으면 false다.
   * 규칙이 이미 date 안에서 끝나도 커서가 뒤처져 있으면 아직 만들 회차가 남은 것이라 커서를 닫는다.
   */
  stopAfter(date: string): boolean {
    const ruleEnded = this.#isEndedAfter(date);
    if (ruleEnded && this.props.nextOccurrenceDate == null) {
      return false;
    }
    if (!ruleEnded) {
      this.props.rule = this.props.rule.endingBefore(addDaysToDateKey(date, 1));
    }
    this.props.nextOccurrenceDate = null;
    return true;
  }

  #isEndedAfter(date: string): boolean {
    const { rule, startDate } = this.props;
    const next = addDaysToDateKey(date, 1);
    return rule.firstOnOrAfter(startDate, next, rule.countBefore(startDate, next)) == null;
  }

  /** pivotDate부터 새 규칙으로 잇고 이 규칙은 그 전날로 끝낸다. 만든 뒤의 회차 수는 0이다. */
  splitFrom(pivotDate: string, changes: TodoSeriesChanges, newId: string, at: Date): TodoSeries {
    const { title, categoryId, visibility, scheduledLocalTime, checklistTemplate } = this.props;
    const rule = changes.rule ?? this.props.rule.continuingFrom(this.props.startDate, pivotDate);
    const next = TodoSeries.planCreation({
      id: newId,
      originSeriesId: this.props.originSeriesId,
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

  /** 시작일은 그대로 두고 규칙만 바꿔 처음부터 다시 센다. 이미 만든 날짜는 저장 때 건너뛴다. */
  replaceRule(rule: RepeatRule): boolean {
    if (rule.equals(this.props.rule)) {
      return false;
    }
    const first = rule.firstOnOrAfter(this.props.startDate, this.props.startDate);
    if (first == null) {
      throw new DomainException(ErrorCode.TODO_0843, {
        startDate: this.props.startDate,
        repeat: rule.toSpec(),
      });
    }
    this.props.rule = rule;
    this.props.nextOccurrenceDate = first;
    this.props.generatedCount = 0;
    return true;
  }

  replaceChecklist(items: readonly ChecklistTemplateItem[]): boolean {
    TodoSeries.#assertChecklist(items);
    if (isEqual(items, this.props.checklistTemplate)) {
      return false;
    }
    this.props.checklistTemplate = items.map((item) => ({ title: item.title }));
    return true;
  }

  getId(): string {
    return this.props.id;
  }

  getUserId(): string {
    return this.props.userId;
  }

  getOriginSeriesId(): string {
    return this.props.originSeriesId;
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
