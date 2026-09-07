import { create } from "zustand";
import type { AppState } from "../domain/models";
import type { Command } from "../domain/commands";

type Toast = { id: number; message: string; kind: "success" | "error" };
type Store = {
  data: AppState | null;
  loading: boolean;
  error: string;
  toasts: Toast[];
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  command: (command: Command, message?: string) => Promise<AppState>;
  toast: (message: string, kind?: Toast["kind"]) => void;
  dismiss: (id: number) => void;
};
let queue: Promise<unknown> = Promise.resolve();
export const useStore = create<Store>((set, get) => ({
  data: null,
  loading: true,
  error: "",
  toasts: [],
  load: async () => {
    set({ loading: true, error: "" });
    try {
      const res = await fetch("/api/state");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      set({ data: body, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  refresh: async () => {
    try {
      const res = await fetch("/api/state");
      if (!res.ok) return;
      const data = (await res.json()) as AppState;
      if (data.revision > (get().data?.revision ?? -1)) set({ data });
    } catch {}
  },
  command: (command, message) => {
    const work = queue
      .catch(() => {})
      .then(async () => {
        const response = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, revision: get().data?.revision }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (result.state) set({ data: result.state });
          throw new Error(
            result.error || "Your update could not be saved. Please try again.",
          );
        }
        set({ data: result });
        if (message) get().toast(message);
        return result as AppState;
      })
      .catch((error) => {
        get().toast(
          error.message ||
            "The server is unavailable. Please reconnect and try again.",
          "error",
        );
        throw error;
      });
    queue = work;
    return work;
  },
  toast: (message, kind = "success") => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => get().dismiss(id), 5500);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
export const useData = () => useStore((s) => s.data!);
export async function copyLink(path: string) {
  const url = new URL(path, location.origin).href;
  await navigator.clipboard.writeText(url);
  useStore.getState().toast("Link copied to clipboard");
}
