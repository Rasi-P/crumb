import type { AppState } from "../../src/domain/models";

export class StateConflict extends Error {
  constructor(public readonly state: AppState) {
    super("Your workspace has a newer update. Please retry your change.");
  }
}

export interface StateRepository {
  read(): Promise<AppState>;
  mutate(
    update: (state: AppState) => AppState,
    revision?: number,
  ): Promise<AppState>;
  consumeLoginAttempt(key: string): Promise<boolean>;
}
