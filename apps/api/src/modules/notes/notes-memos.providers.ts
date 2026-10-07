import {
  convertMemoToTodosProvider,
  convertMemoToTodoProvider,
  createMemoProvider,
  deleteMemoProvider,
  getMemoResourceLimitProvider,
  getMemosProvider,
  getMemoProvider,
  reorderMemoProvider,
  toggleMemoPinProvider,
  updateMemoProvider,
} from "./notes-memos-application.providers.js";

export const MEMO_PROVIDERS = [
  createMemoProvider,
  updateMemoProvider,
  toggleMemoPinProvider,
  reorderMemoProvider,
  deleteMemoProvider,
  convertMemoToTodoProvider,
  convertMemoToTodosProvider,
  getMemoProvider,
  getMemosProvider,
  getMemoResourceLimitProvider,
] as const;
