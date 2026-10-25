// RN의 URLSearchParams는 플랫폼마다 구현 범위가 달라 쿼리 한 값만 직접 읽는다
export function readQueryValue(url: string, key: string) {
  const query = url.split('?', 2)[1]?.split('#', 1)[0];
  if (query == null) {
    return null;
  }

  for (const pair of query.split('&')) {
    const [name, value = ''] = pair.split('=', 2);
    if (name === key) {
      return safeDecodeURIComponent(value);
    }
  }

  return null;
}

export function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
