export const TODO_CATEGORY_PROVISIONER = Symbol("TODO_CATEGORY_PROVISIONER");

export interface TodoCategoryProvisionerPort {
  seed(userId: string): Promise<number>;
}
