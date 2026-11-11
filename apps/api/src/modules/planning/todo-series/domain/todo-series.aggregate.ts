import { ErrorCode } from "@aido/api/errors";
import { RECURRING_TODO_LIMITS, TODO_ITEM_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";
import { isEqual } from "es-toolkit";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import {
  addDaysToKey,
  localDateKeyAt,
  resolveScheduledInstant,
} from "../../shared/domain/todo-calendar.domain-service.js";
import { TodoTitle } from "../../shared/domain/todo-title.vo.js";
import { RepeatRule, type RepeatRuleProps } from "./repeat-rule.vo.js";
import { TodoSeriesId } from "./todo-series-id.vo.js";

/**
 * 새 규칙이 만들 수 있는 지난 회차 상한. 아주 먼 과거에서 시작하면 요청 안에서 수백 행이 지난 미완료로
 * 쌓인다. 출시 앱의 /recurring은 366일 안의 날짜만 보내므로 이 상한에 닿지 않는다.
 */
const MAX_PAST_OCCURRENCES_ON_START = RECURRING_TODO_LIMITS.MAX_DAYS_RANGE;

export interface ChecklistTemplateItem {
  readonly title: string;
}

export interface TodoSeriesPrimitives {
  readonly id: string;
  /** 분할 전 맨 처음 규칙의 id. 분할된 구간을 한 쿼리로 묶는다. 처음 규칙은 자기 id다. */
  readonly originSeriesId: string;
  readonly userId: string;
  readonly categoryId: number;
  readonly title: string;
  readonly visibility: TodoVisibility;
  readonly scheduledLocalTime: string | null;
  readonly timezone: string;
  readonly rule: RepeatRuleProps;
  readonly startDate: string;
  readonly checklistTemplate: readonly ChecklistTemplateItem[];
  readonly nextOccurrenceDate: string | null;
  readonly generatedCount: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface TodoSeriesProps {
  readonly originSeriesId: TodoSeriesId;
  readonly userId: UserId;
  categoryId: number;
  title: TodoTitle;
  visibility: TodoVisibility;
  scheduledLocalTime: string | null;
  timezone: string;
  rule: RepeatRule;
  readonly startDate: string;
  checklistTemplate: readonly ChecklistTemplateItem[];
  nextOccurrenceDate: string | null;
  generatedCount: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface CreateTodoSeriesParams {
  readonly id: TodoSeriesId;
  /** 분할로 이어지는 규칙만 넘긴다. 없으면 이 규칙이 원본이다. */
  readonly originSeriesId?: TodoSeriesId;
  readonly userId: UserId;
  readonly categoryId: number;
  readonly title: TodoTitle;
  readonly visibility: TodoVisibility;
  readonly scheduledLocalTime: string | null;
  readonly timezone: string;
  readonly rule: RepeatRule;
  readonly startDate: string;
  readonly checklistTemplate: readonly ChecklistTemplateItem[];
  readonly now: Temporal.Instant;
}

export interface TodoSeriesChanges {
  readonly title?: string;
  readonly categoryId?: number;
  readonly visibility?: TodoVisibility;
  readonly scheduledLocalTime?: string | null;
  /** 사용자가 시간을 고칠 때만 넘긴다. 그 시각은 이 시간대의 벽시계다. */
  readonly timezone?: string;
  readonly checklistTemplate?: readonly ChecklistTemplateItem[];
  readonly rule?: RepeatRule;
}

/** 회차 한 행의 초안. id는 저장소 nextIds, sortOrder는 저장 직전 사용자 최대값 뒤로 붙인다. */
export interface TodoOccurrenceDraft {
  readonly userId: string;
  readonly categoryId: number;
  readonly title: string;
  readonly visibility: TodoVisibility;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: null;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Temporal.Instant | null;
  readonly isAllDay: boolean;
  readonly occurrenceDate: string;
  readonly createdAt: Temporal.Instant;
}

function assertChecklist(items: readonly ChecklistTemplateItem[]): void {
  if (items.length > TODO_ITEM_LIMITS.MAX_PER_TODO) {
    throw new DomainException(ErrorCode.TODO_0821, {
      currentCount: items.length,
      maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
    });
  }
}

function copyChecklist(items: readonly ChecklistTemplateItem[]): ChecklistTemplateItem[] {
  return items.map((item) => ({ title: item.title }));
}

export class TodoSeries extends AggregateRoot<TodoSeriesId, TodoSeriesProps> {
  /** 만들 수 있는 회차가 없으면 TODO_0843이다. */
  static create(params: CreateTodoSeriesParams): TodoSeries {
    assertChecklist(params.checklistTemplate);
    const first = params.rule.firstOnOrAfter(params.startDate, params.startDate);
    if (first == null) {
      throw new DomainException(ErrorCode.TODO_0843, {
        startDate: params.startDate,
        repeat: params.rule.toSpec(),
      });
    }
    return new TodoSeries(params.id, {
      originSeriesId: params.originSeriesId ?? params.id,
      userId: params.userId,
      categoryId: params.categoryId,
      title: params.title,
      visibility: params.visibility,
      scheduledLocalTime: params.scheduledLocalTime,
      timezone: params.timezone,
      rule: params.rule,
      startDate: params.startDate,
      checklistTemplate: copyChecklist(params.checklistTemplate),
      nextOccurrenceDate: first,
      generatedCount: 0,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: TodoSeriesPrimitives): TodoSeries {
    return new TodoSeries(TodoSeriesId.reconstitute(primitives.id), {
      originSeriesId: TodoSeriesId.reconstitute(primitives.originSeriesId),
      userId: UserId.reconstitute(primitives.userId),
      categoryId: primitives.categoryId,
      title: TodoTitle.reconstitute(primitives.title),
      visibility: primitives.visibility,
      scheduledLocalTime: primitives.scheduledLocalTime,
      timezone: primitives.timezone,
      rule: RepeatRule.reconstitute(primitives.rule),
      startDate: primitives.startDate,
      checklistTemplate: copyChecklist(primitives.checklistTemplate),
      nextOccurrenceDate: primitives.nextOccurrenceDate,
      generatedCount: primitives.generatedCount,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get originSeriesId(): TodoSeriesId {
    return this.props.originSeriesId;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get categoryId(): number {
    return this.props.categoryId;
  }

  get title(): TodoTitle {
    return this.props.title;
  }

  get visibility(): TodoVisibility {
    return this.props.visibility;
  }

  get scheduledLocalTime(): string | null {
    return this.props.scheduledLocalTime;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get rule(): RepeatRule {
    return this.props.rule;
  }

  get startDate(): string {
    return this.props.startDate;
  }

  get checklistTemplate(): ChecklistTemplateItem[] {
    return copyChecklist(this.props.checklistTemplate);
  }

  get nextOccurrenceDate(): string | null {
    return this.props.nextOccurrenceDate;
  }

  get generatedCount(): number {
    return this.props.generatedCount;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get updatedAt(): Temporal.Instant {
    return this.props.updatedAt;
  }

  get isActive(): boolean {
    return this.props.nextOccurrenceDate != null;
  }

  /** 새로 시작하는 규칙만 확인한다. 분할은 이미 있던 규칙을 잇는 것이라 지난 회차 수와 상관없다. */
  assertWithinPastLimit(now: Temporal.Instant): void {
    const { rule, startDate, timezone } = this.props;
    if (
      rule.countBefore(startDate, localDateKeyAt(now, timezone)) > MAX_PAST_OCCURRENCES_ON_START
    ) {
      throw new DomainException(ErrorCode.TODO_0845, { field: "startDate" });
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
      addDaysToKey(last, 1),
      this.props.generatedCount,
    );
    return dates.map((date) => this.#draftOn(date));
  }

  /**
   * 자리 비운 동안 멈춘 커서를 오늘 이후 첫 회차로 옮긴다. 지난 날은 만들지 않지만 COUNT는 달력으로 세어
   * 그 횟수의 날짜가 다 지났으면 끝난다. 채울 때마다 커서는 기간(90일)만큼 앞서므로 오늘보다 뒤처졌다면
   * 그만큼 채우지 못한 것이다. 규칙 행을 고쳤는지(updatedAt)는 채운 시점과 상관없어 보지 않는다.
   */
  skipDormantGap(now: Temporal.Instant): boolean {
    const { nextOccurrenceDate, generatedCount, rule, startDate, timezone } = this.props;
    const today = localDateKeyAt(now, timezone);
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
      userId: userId.value,
      categoryId,
      title: title.value,
      visibility,
      startDate: Temporal.PlainDate.from(date),
      endDate: null,
      scheduledLocalTime,
      // DST로 오프셋이 달라지므로 회차 날짜마다 규칙 시간대로 다시 해석한다.
      scheduledTime: resolveScheduledInstant(date, scheduledLocalTime, timezone),
      isAllDay: scheduledLocalTime == null,
      occurrenceDate: date,
      // 리텐션·성장 지표가 createdAt을 사용자 행동으로 쓰므로 규칙을 만든 시각을 물려받는다.
      createdAt: this.props.createdAt,
    };
  }

  /**
   * date 뒤로 회차를 만들지 않는다. 더 끝낼 게 없으면 false다.
   * 규칙이 이미 date 안에서 끝나도 커서가 뒤처져 있으면 아직 만들 회차가 남은 것이라 커서를 닫는다.
   * 첫 회차부터 끝내도 종료일이 시작일보다 앞서지 않게 시작일로 맞춘다. 응답의 끝 날짜가 앱에 그대로 보인다.
   */
  stopAfter(date: string): boolean {
    const lastDate = date < this.props.startDate ? this.props.startDate : date;
    const ruleEnded = this.#isEndedAfter(lastDate);
    if (ruleEnded && this.props.nextOccurrenceDate == null) {
      return false;
    }
    if (!ruleEnded) {
      this.props.rule = this.props.rule.endingBefore(addDaysToKey(lastDate, 1));
    }
    this.props.nextOccurrenceDate = null;
    return true;
  }

  #isEndedAfter(date: string): boolean {
    const { rule, startDate } = this.props;
    const next = addDaysToKey(date, 1);
    return rule.firstOnOrAfter(startDate, next, rule.countBefore(startDate, next)) == null;
  }

  /** pivotDate부터 새 규칙으로 잇고 이 규칙은 그 전날로 끝낸다. 만든 뒤의 회차 수는 0이다. */
  splitFrom(params: {
    readonly pivotDate: string;
    readonly changes: TodoSeriesChanges;
    readonly id: TodoSeriesId;
    readonly now: Temporal.Instant;
  }): TodoSeries {
    const { pivotDate, changes } = params;
    const { title, categoryId, visibility, scheduledLocalTime, checklistTemplate } = this.props;
    const next = TodoSeries.create({
      id: params.id,
      originSeriesId: this.props.originSeriesId,
      userId: this.props.userId,
      categoryId: changes.categoryId ?? categoryId,
      title: changes.title == null ? title : TodoTitle.create(changes.title),
      visibility: changes.visibility ?? visibility,
      scheduledLocalTime:
        // oxlint-disable-next-line aido/no-strict-nullish -- null은 시간 지우기, undefined는 유지다
        changes.scheduledLocalTime === undefined ? scheduledLocalTime : changes.scheduledLocalTime,
      timezone: changes.timezone ?? this.props.timezone,
      rule: changes.rule ?? this.props.rule.continuingFrom(this.props.startDate, pivotDate),
      startDate: pivotDate,
      checklistTemplate: changes.checklistTemplate ?? checklistTemplate,
      now: params.now,
    });
    this.stopAfter(addDaysToKey(pivotDate, -1));
    return next;
  }

  /** 규칙은 그대로 두고 제목·카테고리·공개·시간(과 그 시간대)만 바꾼다. 바뀐 게 있으면 true다. */
  applyDetails(changes: Omit<TodoSeriesChanges, "rule" | "checklistTemplate">): boolean {
    let changed = false;
    if (changes.title != null && changes.title !== this.props.title.value) {
      this.props.title = TodoTitle.create(changes.title);
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
    if (
      // oxlint-disable-next-line aido/no-strict-nullish -- null은 시간 지우기, undefined는 유지다
      changes.scheduledLocalTime !== undefined &&
      changes.scheduledLocalTime !== this.props.scheduledLocalTime
    ) {
      this.props.scheduledLocalTime = changes.scheduledLocalTime;
      changed = true;
    }
    if (changes.timezone != null && changes.timezone !== this.props.timezone) {
      this.props.timezone = changes.timezone;
      changed = true;
    }
    return changed;
  }

  /** other에 맞추려면 바꿔야 할 값만 돌려준다. 같은 값은 비워 회차별로 고친 내용을 덮지 않는다. */
  resolveChangesToMatch(other: TodoSeries): Omit<TodoSeriesChanges, "rule" | "checklistTemplate"> {
    const { title, categoryId, visibility, scheduledLocalTime, timezone } = other.props;
    const isTimeSame =
      scheduledLocalTime === this.props.scheduledLocalTime &&
      (scheduledLocalTime == null || timezone === this.props.timezone);
    return {
      title: title.equals(this.props.title) ? undefined : title.value,
      categoryId: categoryId === this.props.categoryId ? undefined : categoryId,
      visibility: visibility === this.props.visibility ? undefined : visibility,
      scheduledLocalTime: isTimeSame ? undefined : scheduledLocalTime,
      timezone: isTimeSame || scheduledLocalTime == null ? undefined : timezone,
    };
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
    assertChecklist(items);
    if (isEqual(items, this.props.checklistTemplate)) {
      return false;
    }
    this.props.checklistTemplate = copyChecklist(items);
    return true;
  }

  toPrimitives(): TodoSeriesPrimitives {
    return {
      id: this.id.value,
      originSeriesId: this.props.originSeriesId.value,
      userId: this.props.userId.value,
      categoryId: this.props.categoryId,
      title: this.props.title.value,
      visibility: this.props.visibility,
      scheduledLocalTime: this.props.scheduledLocalTime,
      timezone: this.props.timezone,
      rule: this.props.rule.toPrimitives(),
      startDate: this.props.startDate,
      checklistTemplate: copyChecklist(this.props.checklistTemplate),
      nextOccurrenceDate: this.props.nextOccurrenceDate,
      generatedCount: this.props.generatedCount,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
