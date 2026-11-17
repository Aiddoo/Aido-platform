// 꺼지면 지금 분석 받기 버튼 대신 다음 자동 분석 시각만 보인다(배포 없이 env로 끈다)
export abstract class OnDemandSuggestionAnalysisConfigPort {
  abstract readonly isEnabled: boolean;
}
