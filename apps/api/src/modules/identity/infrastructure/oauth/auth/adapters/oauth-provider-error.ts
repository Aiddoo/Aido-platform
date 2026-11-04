const PROVIDER_ERROR_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/** OAuth 오류 본문(`{ error, error_code }`)에서 공급자의 짧은 오류 기호만 읽는다. 설명·원문은 버린다. */
export async function readOAuthProviderError(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    return [Reflect.get(Object(body), "error_code"), Reflect.get(Object(body), "error")]
      .filter((value) => typeof value === "string")
      .find((value) => PROVIDER_ERROR_PATTERN.test(value));
  } catch {
    return undefined;
  }
}
