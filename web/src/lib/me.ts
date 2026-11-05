// 当前登录的管理员。只在后台页用到；401 时置空。
import { useEffect, useSyncExternalStore } from "react";
import type { SessionInfo } from "../../../src/shared/types.ts";
import { UNAUTHORIZED_EVENT, api } from "../api.ts";

interface MeState { loaded: boolean; user: SessionInfo | null; expired: boolean }
let state: MeState = { loaded: false, user: null, expired: false };
const subs = new Set<() => void>();
const set = (s: Partial<MeState>) => {
  state = { ...state, ...s };
  subs.forEach((f) => f());
};
let started = false;

export function loadMe() {
  if (started) return;
  started = true;
  api<{ user: SessionInfo | null }>("/api/me")
    .then((r) => set({ loaded: true, user: r.user }))
    .catch(() => set({ loaded: true, user: null }));
  window.addEventListener(UNAUTHORIZED_EVENT, () => set({ user: null, expired: true }));
}

export function useMe() {
  useEffect(loadMe, []);
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}
