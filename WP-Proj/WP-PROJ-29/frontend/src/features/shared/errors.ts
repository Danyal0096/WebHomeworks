import type { TFunction } from "i18next";
import { RepositoryError } from "../../repositories/localRepository";

export function uiError(reason: unknown, t: TFunction): string {
  if (reason instanceof RepositoryError) return t(reason.code);
  return t("error");
}
