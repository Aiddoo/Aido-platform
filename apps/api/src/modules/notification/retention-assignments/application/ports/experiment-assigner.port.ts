interface ExperimentVariantWeight<TVariant extends string> {
  readonly key: TVariant;
  readonly weight: number;
}

export interface ExperimentAssignment<TVariant extends string> {
  readonly experimentKey: string;
  readonly subjectId: string;
  // 앞에서부터 weight만큼 구간을 차지한다. 순서를 바꾸면 이미 배정된 사용자의 실험군이 바뀐다
  readonly variants: readonly ExperimentVariantWeight<TVariant>[];
}

// 같은 실험·대상은 실행·재시도·프로세스와 상관없이 항상 같은 실험군을 받는다
export abstract class ExperimentAssignerPort {
  abstract assign<TVariant extends string>(assignment: ExperimentAssignment<TVariant>): TVariant;
}
