import type { TodoVisibility } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { localDateAt } from "../../shared/domain/todo-calendar.domain-service.js";
import { TodoTitle } from "../../shared/domain/todo-title.vo.js";
import { ChecklistTemplate, type ChecklistTemplateItem } from "./checklist-template.vo.js";
import { occurrenceHorizon } from "./occurrence-horizon.domain-service.js";
import { RepeatRule, type RepeatRuleProps } from "./repeat-rule.vo.js";
import type {
  TodoSeriesChanges,
  TodoSeriesDetailChanges,
} from "./series-changes.domain-service.js";
import {
  draftOccurrence,
  type TodoOccurrenceDraft,
} from "./todo-occurrence-draft.domain-service.js";
import { TodoOccurrencesChangedEvent } from "./todo-occurrences-changed.event.js";
import { TodoOccurrencesCreatedEvent } from "./todo-occurrences-created.event.js";
import { TodoSeriesId } from "./todo-series-id.vo.js";
import { MAX_OCCURRENCES_PER_RUN, MAX_PAST_OCCURRENCES_ON_START } from "./todo-series.constants.js";
import { invalidRepeatRule, noRepeatDates } from "./todo-series.errors.js";

export type TodoSeriesEvent = TodoOccurrencesCreatedEvent | TodoOccurrencesChangedEvent;

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
  readonly startDate: Temporal.PlainDate;
  readonly checklistTemplate: readonly ChecklistTemplateItem[];
  readonly nextOccurrenceDate: Temporal.PlainDate | null;
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
  readonly startDate: Temporal.PlainDate;
  checklistTemplate: ChecklistTemplate;
  nextOccurrenceDate: Temporal.PlainDate | null;
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
  readonly startDate: Temporal.PlainDate;
  readonly checklistTemplate: readonly ChecklistTemplateItem[];
  readonly now: Temporal.Instant;
}

export class TodoSeries extends AggregateRoot<TodoSeriesId, TodoSeriesProps, TodoSeriesEvent> {
  static create(params: CreateTodoSeriesParams): TodoSeries {
    const checklistTemplate = ChecklistTemplate.create(params.checklistTemplate);
    const first = params.rule.firstOnOrAfter(params.startDate, params.startDate);
    if (first == null) {
      throw noRepeatDates(params.startDate.toString(), params.rule.toSpec());
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
      checklistTemplate,
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
      checklistTemplate: ChecklistTemplate.reconstitute(primitives.checklistTemplate),
      nextOccurrenceDate: primitives.nextOccurrenceDate,
      generatedCount: primitives.generatedCount,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  // 회차 묶음 변경은 구독자에게 규칙당 한 번만 알린다
  #occurrencesChangeRaised = false;
  #deleted = false;

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

  get startDate(): Temporal.PlainDate {
    return this.props.startDate;
  }

  get checklistTemplate(): ChecklistTemplateItem[] {
    return this.props.checklistTemplate.toPrimitives();
  }

  get nextOccurrenceDate(): Temporal.PlainDate | null {
    return this.props.nextOccurrenceDate;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get updatedAt(): Temporal.Instant {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.nextOccurrenceDate != null;
  }

  /** 새로 시작하는 규칙만 확인한다. 분할은 이미 있던 규칙을 잇는 것이라 지난 회차 수와 상관없다. */
  assertWithinPastLimit(now: Temporal.Instant): void {
    const { rule, startDate, timezone } = this.props;
    if (rule.countBefore(startDate, localDateAt(now, timezone)) > MAX_PAST_OCCURRENCES_ON_START) {
      throw invalidRepeatRule("startDate");
    }
  }

  /** 미리 만드는 기간까지 계획한다. 먼 미래에 시작하는 새 규칙도 첫 회차는 바로 보여야 한다. */
  planFirstRun(now: Temporal.Instant): TodoOccurrenceDraft[] {
    const horizon = occurrenceHorizon(this.props.timezone, now);
    const next = this.props.nextOccurrenceDate;
    const through = next != null && Temporal.PlainDate.compare(next, horizon) > 0 ? next : horizon;
    return this.planOccurrences(through, MAX_OCCURRENCES_PER_RUN);
  }

  planDueRun(now: Temporal.Instant): TodoOccurrenceDraft[] {
    this.skipDormantGap(now);
    return this.planOccurrences(
      occurrenceHorizon(this.props.timezone, now),
      MAX_OCCURRENCES_PER_RUN,
    );
  }

  // 다음 회차부터 through(포함)까지 초안을 만들고 커서를 그 뒤로 옮긴다. limit을 넘는 회차는 다음 실행이 만든다
  planOccurrences(
    through: Temporal.PlainDate,
    limit = Number.POSITIVE_INFINITY,
  ): TodoOccurrenceDraft[] {
    const { nextOccurrenceDate, rule, startDate, generatedCount } = this.props;
    if (nextOccurrenceDate == null) {
      return [];
    }
    const dates = rule
      .occurrencesBetween({
        seriesStart: startDate,
        from: nextOccurrenceDate,
        through,
        generatedCount,
      })
      .slice(0, limit);
    const last = dates.at(-1);
    if (last == null) {
      return [];
    }
    this.props.generatedCount = generatedCount + dates.length;
    this.props.nextOccurrenceDate = rule.firstOnOrAfter(
      startDate,
      last.add({ days: 1 }),
      this.props.generatedCount,
    );
    this.raise(
      new TodoOccurrencesCreatedEvent(this.id.value, this.props.userId.value, dates.length),
    );
    return dates.map((date) => draftOccurrence(this.props, date));
  }

  // date 뒤로 회차를 만들지 않는다. 규칙이 이미 끝났어도 커서가 뒤처져 있으면 닫는다.
  // 응답의 끝 날짜가 앱에 보이므로 종료일이 시작일보다 앞서지 않게 시작일로 맞춘다
  stopAfter(date: Temporal.PlainDate): boolean {
    const { startDate } = this.props;
    const lastDate = Temporal.PlainDate.compare(date, startDate) < 0 ? startDate : date;
    const ruleEnded = this.#isEndedAfter(lastDate);
    if (ruleEnded && this.props.nextOccurrenceDate == null) {
      return false;
    }
    if (!ruleEnded) {
      this.props.rule = this.props.rule.endingBefore(lastDate.add({ days: 1 }));
    }
    this.props.nextOccurrenceDate = null;
    this.#raiseOccurrencesChanged();
    return true;
  }

  /** pivotDate부터 새 규칙으로 잇고 이 규칙은 그 전날로 끝낸다. 만든 뒤의 회차 수는 0이다. */
  splitFrom(params: {
    readonly pivotDate: Temporal.PlainDate;
    readonly changes: TodoSeriesChanges;
    readonly id: TodoSeriesId;
    readonly now: Temporal.Instant;
  }): TodoSeries {
    const { pivotDate, changes } = params;
    const { title, categoryId, visibility, scheduledLocalTime } = this.props;
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
      checklistTemplate: changes.checklistTemplate ?? this.checklistTemplate,
      now: params.now,
    });
    this.stopAfter(pivotDate.subtract({ days: 1 }));
    return next;
  }

  /** 규칙은 그대로 두고 제목·카테고리·공개·시간(과 그 시간대)만 바꾼다. 바뀐 게 있으면 true다. */
  applyDetails(changes: TodoSeriesDetailChanges): boolean {
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
    if (changed) {
      this.#raiseOccurrencesChanged();
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
      throw noRepeatDates(this.props.startDate.toString(), rule.toSpec());
    }
    this.props.rule = rule;
    this.props.nextOccurrenceDate = first;
    this.props.generatedCount = 0;
    this.#raiseOccurrencesChanged();
    return true;
  }

  replaceChecklist(items: readonly ChecklistTemplateItem[]): boolean {
    const checklistTemplate = ChecklistTemplate.create(items);
    if (checklistTemplate.equals(this.props.checklistTemplate)) {
      return false;
    }
    this.props.checklistTemplate = checklistTemplate;
    this.#raiseOccurrencesChanged();
    return true;
  }

  // 분할로 이어진 규칙을 함께 지울 때 이 규칙이 회차가 바뀐 사실을 낸다. 행은 저장소가 묶음으로 지운다
  markDeleted(): boolean {
    if (this.#deleted) {
      return false;
    }
    this.#deleted = true;
    this.#raiseOccurrencesChanged();
    return true;
  }

  // 자리 비운 동안 멈춘 커서를 오늘 이후 첫 회차로 옮긴다. 지난 날은 만들지 않지만 COUNT는 달력으로 세어
  // 그 횟수의 날짜가 다 지났으면 끝난다. 규칙 행을 고쳤는지(updatedAt)는 채운 시점과 상관없어 보지 않는다
  skipDormantGap(now: Temporal.Instant): boolean {
    const { nextOccurrenceDate, generatedCount, rule, startDate, timezone } = this.props;
    const today = localDateAt(now, timezone);
    if (nextOccurrenceDate == null || Temporal.PlainDate.compare(nextOccurrenceDate, today) >= 0) {
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

  toPrimitives(): TodoSeriesPrimitives {
    return {
      ...this.props,
      id: this.id.value,
      originSeriesId: this.props.originSeriesId.value,
      userId: this.props.userId.value,
      title: this.props.title.value,
      rule: this.props.rule.toPrimitives(),
      checklistTemplate: this.props.checklistTemplate.toPrimitives(),
    };
  }

  #isEndedAfter(date: Temporal.PlainDate): boolean {
    const { rule, startDate } = this.props;
    const next = date.add({ days: 1 });
    return rule.firstOnOrAfter(startDate, next, rule.countBefore(startDate, next)) == null;
  }

  #raiseOccurrencesChanged(): void {
    if (this.#occurrencesChangeRaised) {
      return;
    }
    this.#occurrencesChangeRaised = true;
    this.raise(new TodoOccurrencesChangedEvent(this.id.value, this.props.userId.value));
  }
}
