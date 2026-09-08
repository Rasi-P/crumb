import { StateConflict, type StateRepository } from "./types";

let repository: Promise<StateRepository> | undefined;
export function getRepository(): Promise<StateRepository> {
  if (!repository)
    repository = createRepository().catch((error) => {
      repository = undefined;
      throw error;
    });
  return repository;
}
async function createRepository(): Promise<StateRepository> {
  if (process.env.DATABASE_URL) {
    const { PostgresRepository } = await import("./postgres");
    return new PostgresRepository(process.env.DATABASE_URL);
  }
  if (process.env.VERCEL)
    throw new Error(
      "Connect a Postgres database and set DATABASE_URL before deploying.",
    );
  const local = await import("../database");
  return {
    read: async () => local.loadState(),
    mutate: async (update, revision) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = local.loadState();
        if (revision !== undefined && current.revision !== revision)
          throw new StateConflict(current);
        const next = update(current);
        try {
          local.saveState(next, current.revision);
          return next;
        } catch (error) {
          if (!(error instanceof StateConflict) || revision !== undefined)
            throw error;
        }
      }
      throw new StateConflict(local.loadState());
    },
    consumeLoginAttempt: async (key) => local.consumeLoginAttempt(key),
  };
}
