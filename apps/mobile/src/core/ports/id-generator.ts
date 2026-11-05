/** 기기에서 만드는 고유 id. 초안 id와 멱등 키에 쓴다 */
export interface IdGenerator {
  create(): string;
}
