// 성장 지표의 여러 조회가 같은 시점 데이터를 보도록 한 읽기 전용 스냅샷 트랜잭션에서 실행한다
export abstract class GrowthMetricsSnapshotPort {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
