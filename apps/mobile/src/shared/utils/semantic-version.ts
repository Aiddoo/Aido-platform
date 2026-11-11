// 서버와 같은 SemVer 비교를 모델이 쓰게 한다. 모델은 @aido/api 계약을 직접 import하지 않는다
export { compareSemanticVersions, isSemanticVersionAtLeast } from '@aido/api/vocabulary';
