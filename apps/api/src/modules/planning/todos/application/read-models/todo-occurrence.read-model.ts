export interface TodoOccurrenceReadModel {
  readonly todoId: number;
  readonly seriesId: string;
  readonly occurrenceDate: string;
  readonly startDate: string;
  readonly completed: boolean;
}
