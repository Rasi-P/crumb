import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";

export const assetTypes = {
  "model/gltf-binary": "glb",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;
export type AssetType = keyof typeof assetTypes;
export type StoredAsset = { contentType: AssetType; data: Buffer };

// Generated models and reference photographs. IDs are 32 hex characters and
// act as unguessable links, so saved designs can reference them by URL.
export interface AssetStore {
  put(id: string, asset: StoredAsset): Promise<void>;
  get(id: string): Promise<StoredAsset | null>;
}

export const assetId = /^[a-f0-9]{32}$/;

export class DiskAssetStore implements AssetStore {
  constructor(private readonly directory: string) {}
  async put(id: string, asset: StoredAsset) {
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, `${id}.${assetTypes[asset.contentType]}`);
    await writeFile(`${path}.tmp`, asset.data);
    await rename(`${path}.tmp`, path);
  }
  async get(id: string) {
    for (const [contentType, extension] of Object.entries(assetTypes))
      try {
        return {
          contentType: contentType as AssetType,
          data: await readFile(join(this.directory, `${id}.${extension}`)),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    return null;
  }
}

export class PostgresAssetStore implements AssetStore {
  private initialized?: Promise<unknown>;
  constructor(private readonly pool: Pool) {}
  private ready() {
    this.initialized ??= this.pool
      .query(
        `CREATE TABLE IF NOT EXISTS crumb_studio_assets (id TEXT PRIMARY KEY, content_type TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
      )
      .catch((error) => {
        this.initialized = undefined;
        throw error;
      });
    return this.initialized;
  }
  async put(id: string, asset: StoredAsset) {
    await this.ready();
    await this.pool.query(
      `INSERT INTO crumb_studio_assets (id, content_type, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [id, asset.contentType, asset.data],
    );
  }
  async get(id: string) {
    await this.ready();
    const result = await this.pool.query(
      "SELECT content_type, data FROM crumb_studio_assets WHERE id = $1",
      [id],
    );
    return result.rowCount
      ? {
          contentType: result.rows[0].content_type as AssetType,
          data: result.rows[0].data as Buffer,
        }
      : null;
  }
}

let store: Promise<AssetStore> | undefined;
export function getAssetStore(): Promise<AssetStore> {
  store ??= (async () => {
    if (process.env.DATABASE_URL) {
      const { createPool } = await import("./postgres");
      return new PostgresAssetStore(createPool(process.env.DATABASE_URL));
    }
    return new DiskAssetStore(
      process.env.STUDIO_ASSET_PATH || ".data/studio-assets",
    );
  })().catch((error) => {
    store = undefined;
    throw error;
  });
  return store;
}
