/** 단건 변경이 대상 행을 찾지 못했음을 repository 계약의 부재 오류로 드러낸다. */
export class DatabaseRecordNotFoundError extends Error {
  constructor() {
    super("Database record not found");
    this.name = "DatabaseRecordNotFoundError";
  }
}
