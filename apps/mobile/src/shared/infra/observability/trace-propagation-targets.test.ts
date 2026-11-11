import { toTracePropagationTargets } from './trace-propagation-targets';

function isPropagated(targets: RegExp[], requestUrl: string): boolean {
  return targets.some((target) => target.test(requestUrl));
}

describe('toTracePropagationTargets', () => {
  it.each([
    'https://api.aido.kr',
    'https://api.aido.kr/',
    'https://api.aido.kr/v1/todos?date=2026-11-11',
  ])('API 출처의 요청 %s에는 추적 헤더를 붙인다', (requestUrl) => {
    // Given
    const targets = toTracePropagationTargets('https://api.aido.kr');

    // When
    const propagated = isPropagated(targets, requestUrl);

    // Then
    expect(propagated).toBe(true);
  });

  it.each([
    'https://api.aido.kr.evil.com/v1/todos',
    'https://cdn.example.com/?next=https://api.aido.kr/v1',
    'http://api.aido.kr/v1/todos',
    'https://api.aido.kr:8443/v1/todos',
    'https://firebaseinstallations.googleapis.com/v1/projects',
  ])('API 출처가 아닌 요청 %s에는 붙이지 않는다', (requestUrl) => {
    // Given
    const targets = toTracePropagationTargets('https://api.aido.kr');

    // When
    const propagated = isPropagated(targets, requestUrl);

    // Then
    expect(propagated).toBe(false);
  });

  it('개발 서버는 포트까지 같은 출처만 대상이다', () => {
    // Given
    const targets = toTracePropagationTargets('http://10.0.2.2:8080');

    // When
    const samePort = isPropagated(targets, 'http://10.0.2.2:8080/v1/todos');
    const longerPort = isPropagated(targets, 'http://10.0.2.2:80801/v1/todos');

    // Then
    expect(samePort).toBe(true);
    expect(longerPort).toBe(false);
  });

  it('API 주소를 읽을 수 없으면 SDK 기본값(모든 주소)으로 넘기지 않고 빈 목록을 돌려준다', () => {
    // When
    const targets = toTracePropagationTargets('not a url');

    // Then
    expect(targets).toEqual([]);
  });
});
