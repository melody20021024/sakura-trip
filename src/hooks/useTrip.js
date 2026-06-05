import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { resolveTripKey } from "../lib/tripKey.js";
import { loadTrip, saveTrip, markClean } from "../lib/db.js";
import { pullRemote, pushRemote, subscribeRemote } from "../lib/sync.js";
import { mergeTrip } from "../lib/merge.js";
import { migrate } from "../lib/migrate.js";
import { freshDefault, uid, now } from "../lib/schema.js";

const PUSH_DEBOUNCE = 600;
const MAX_RETRY = 3;

// Single source of truth for the whole app. Owns local persistence, cloud
// sync, sync-state, and all stamped mutators. Views never touch Supabase or
// IndexedDB directly — they call the mutators returned here.
export function useTrip() {
  const { key, lsAvailable } = useMemo(resolveTripKey, []);
  const clientId = useMemo(() => Math.random().toString(36).slice(2), []);

  const [data, setData] = useState(null);
  const [syncState, setSyncState] = useState("syncing"); // synced|syncing|offline|failed
  const [pending, setPending] = useState(0);

  const dataRef = useRef(null);
  const remoteRef = useRef(null); // last known cloud copy, for merge-on-push
  const timer = useRef(null);
  const retries = useRef(0);

  const apply = (next) => {
    dataRef.current = next;
    setData(next);
  };

  // ---- push pipeline (debounced) ----
  const doPush = useCallback(async () => {
    if (!navigator.onLine) { setSyncState("offline"); return; }
    const merged = mergeTrip(dataRef.current, remoteRef.current);
    setSyncState("syncing");
    try {
      await pushRemote(key, merged, clientId);
      remoteRef.current = merged;
      retries.current = 0;
      await markClean(key);
      setPending(0);
      setSyncState("synced");
    } catch (e) {
      if (retries.current < MAX_RETRY && navigator.onLine) {
        retries.current += 1;
        const wait = 1000 * 2 ** (retries.current - 1);
        setSyncState("syncing");
        setTimeout(doPush, wait);
      } else {
        setSyncState(navigator.onLine ? "failed" : "offline");
      }
    }
  }, [key, clientId]);

  const schedulePush = useCallback(() => {
    setPending((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(doPush, PUSH_DEBOUNCE);
  }, [doPush]);

  // commit local edit: render now, persist locally, queue a push
  const commit = useCallback((next) => {
    apply(next);
    saveTrip(key, next, { dirty: true });
    schedulePush();
  }, [key, schedulePush]);

  // ---- initial load: local-first, then merge cloud ----
  useEffect(() => {
    let alive = true;
    (async () => {
      const local = await loadTrip(key);
      let base = local ? migrate(local) : freshDefault();
      if (alive) apply(base);
      try {
        const remote = await pullRemote(key);
        if (remote) {
          remoteRef.current = remote;
          base = mergeTrip(base, remote);
          if (alive) apply(base);
        }
        // Persist the merged base; brand-new trips (no local, no remote) need
        // to be pushed so the cloud row exists.
        await saveTrip(key, base, { dirty: !local && !remote });
        if (!local && !remote) {
          await pushRemote(key, base, clientId).then(() => { remoteRef.current = base; markClean(key); }).catch(() => {});
        }
        if (alive) setSyncState(navigator.onLine ? "synced" : "offline");
      } catch {
        if (alive) setSyncState(navigator.onLine ? "failed" : "offline");
      }
    })();
    return () => { alive = false; };
  }, [key, clientId]);

  // ---- realtime: merge edits from other clients (F-03/F-05) ----
  useEffect(() => {
    return subscribeRemote(key, clientId, (remote) => {
      remoteRef.current = remote;
      const merged = mergeTrip(dataRef.current, remote);
      apply(merged);
      saveTrip(key, merged, { dirty: false });
    });
  }, [key, clientId]);

  // ---- offline / online transitions ----
  useEffect(() => {
    const goOffline = () => setSyncState("offline");
    const goOnline = () => { retries.current = 0; doPush(); };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [doPush]);

  const retry = useCallback(() => { retries.current = 0; doPush(); }, [doPush]);

  // ===== stamped mutators (touch only the changed item's updatedAt) =====
  const d = () => dataRef.current;

  const setField = (name, value) => commit({ ...d(), [name]: { v: value, updatedAt: now() } });
  const setTravelers = (travelers) => commit({ ...d(), travelers });

  const listAdd = (field, item) =>
    commit({ ...d(), [field]: [...d()[field], { id: uid(), updatedAt: now(), ...item }] });
  const listUpdate = (field, id, patch) =>
    commit({ ...d(), [field]: d()[field].map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)) });
  const listDelete = (field, id) =>
    commit({ ...d(), [field]: d()[field].map((x) => (x.id === id ? { ...x, _deleted: true, updatedAt: now() } : x)) });

  const dayMutate = (dayId, fn) =>
    commit({ ...d(), days: d().days.map((day) => (day.id === dayId ? { ...day, ...fn(day), updatedAt: now() } : day)) });

  const mutators = {
    setField,
    setTravelers,
    // flights
    addFlight: (f) => listAdd("flights", f),
    updateFlight: (id, patch) => listUpdate("flights", id, patch),
    deleteFlight: (id) => listDelete("flights", id),
    // days
    addDays: (newDays) => commit({ ...d(), days: [...d().days, ...newDays] }),
    updateDay: (id, patch) => commit({ ...d(), days: d().days.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)) }),
    deleteDay: (id) => commit({ ...d(), days: d().days.map((x) => (x.id === id ? { ...x, _deleted: true, updatedAt: now() } : x)) }),
    // day items (nested)
    addItem: (dayId, item) => dayMutate(dayId, (day) => ({
      items: [...day.items, { id: uid(), order: day.items.filter((i) => !i._deleted).length, time: "", note: "", updatedAt: now(), ...item }],
    })),
    updateItem: (dayId, itemId, patch) => dayMutate(dayId, (day) => ({
      items: day.items.map((i) => (i.id === itemId ? { ...i, ...patch, updatedAt: now() } : i)),
    })),
    deleteItem: (dayId, itemId) => dayMutate(dayId, (day) => ({
      items: day.items.map((i) => (i.id === itemId ? { ...i, _deleted: true, updatedAt: now() } : i)),
    })),
    reorderItems: (dayId, orderedIds) => dayMutate(dayId, (day) => ({
      items: day.items.map((i) => {
        const idx = orderedIds.indexOf(i.id);
        return idx >= 0 ? { ...i, order: idx, updatedAt: now() } : i;
      }),
    })),
    // expenses
    addExpense: (e) => listAdd("expenses", e),
    deleteExpense: (id) => listDelete("expenses", id),
    // checklists (food/shopping/packing)
    addCheck: (field, item) => listAdd(field, item),
    toggleCheck: (field, id) => {
      const cur = d()[field].find((x) => x.id === id);
      listUpdate(field, id, { done: !cur?.done });
    },
    deleteCheck: (field, id) => listDelete(field, id),
    addManyChecks: (field, names) =>
      commit({ ...d(), [field]: [...d()[field], ...names.map((name) => ({ id: uid(), name, done: false, updatedAt: now() }))] }),
    // albums
    addAlbum: (a) => listAdd("albums", a),
    deleteAlbum: (id) => listDelete("albums", id),
  };

  return { key, clientId, lsAvailable, data, syncState, pending, retry, ...mutators };
}
