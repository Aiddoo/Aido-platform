export abstract class UserTagGeneratorPort {
  // 무작위라 겹칠 수 있어 저장소가 쓰기 전에 다시 확인한다
  abstract generate(): string;
}
