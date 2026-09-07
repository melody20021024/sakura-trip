import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { resolveTripKey } from "../lib/tripKey.js";
import { loadTrip, saveTrip, markClean } from "../lib/db.js";
import { pullRemote, pushRemote, subscribeRemote } from "../lib/sync.js";
import { mergeTrip, normalizeTrip } from "../lib/merge.js";
import { migrate } from "../lib/migrate.js";
import { freshDefault, uid, now } from "../lib/schema.js";
import { placeToItem } from "../lib/places.js";

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
  const retryTimer = useRef(null);
  const retries = useRef(0);
  const pushing = useRef(false); // single-flight guard
  const pushAgain = useRef(false); // a commit arrived mid-push
  const activeField = useRef(null); // field key currently being edited (F-05)
  const seq = useRef(0); // monotonic commit counter
  const pushedSeq = useRef(0); // last seq confirmed pushed

  const focusField = useCallback((keyName) => { activeField.current = keyName; }, []);
  const blurField = useCallback(() => { activeField.current = null; }, []);

  const apply = (next) => {
    dataRef.current = next;
    setData(next);
  };

  // Adopt a merged-with-remote snapshot, but keep the value of the field the
  // user is currently editing (F-05) so an incoming remote change can't
  // overwrite an in-progress edit. Field key is either a scalar name
  // ("tripName") or "day:<id>:<field>".
  const applyRemote = (merged) => {
    const f = activeField.current;
    let next = merged;
    if (f && dataRef.current) {
      const local = dataRef.current;
      if (f.startsWith("day:")) {
        const [, id, field] = f.split(":");
        next = { ...merged, days: merged.days.map((day) => {
          if (day.id !== id) return day;
          const localDay = local.days.find((x) => x.id === id);
          return localDay ? { ...day, [field]: localDay[field] } : day;
        }) };
      } else if (f in merged && f in local) {
        next = { ...merged, [f]: local[f] };
      }
    }
    apply(next);
    saveTrip(key, next, { dirty: false });
  };

  // ---- push pipeline: read-merge-write, single-flight ----
  const doPush = useCallback(async () => {
    if (!navigator.onLine) { setSyncState("offline"); return; }
    if (pushing.current) { pushAgain.current = true; return; } // single-flight
    pushing.current = true;
    setSyncState("syncing");
    const target = seq.current;
    try {
      const merged = await pushRemote(key, dataRef.current, clientId);
      remoteRef.current = merged;
      // Re-merge against the CURRENT local data, not the snapshot we pushed:
      // edits committed during the in-flight push live in dataRef.current and
      // would otherwise be dropped when we adopt the push result.
      applyRemote(mergeTrip(dataRef.current, merged));
      retries.current = 0;
      await markClean(key);
      pushedSeq.current = target;
      setPending(Math.max(0, seq.current - target));
      setSyncState("synced");
      pushing.current = false;
      // commits that arrived while we were pushing -> push again
      if (pushAgain.current || seq.current > target) { pushAgain.current = false; doPush(); }
    } catch (e) {
      pushing.current = false;
      if (retries.current < MAX_RETRY && navigator.onLine) {
        retries.current += 1;
        const wait = 1000 * 2 ** (retries.current - 1);
        setSyncState("syncing");
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(doPush, wait);
      } else {
        setSyncState(navigator.onLine ? "failed" : "offline");
      }
    }
  }, [key, clientId]);

  const schedulePush = useCallback(() => {
    setPending(Math.max(0, seq.current - pushedSeq.current));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(doPush, PUSH_DEBOUNCE);
  }, [doPush]);

  // commit local edit: render now, persist locally, queue a push
  const commit = useCallback((next) => {
    seq.current += 1;
    apply(next);
    saveTrip(key, next, { dirty: true });
    schedulePush();
  }, [key, schedulePush]);

  // ---- initial load: local-first, then merge cloud ----
  useEffect(() => {
    let alive = true;
    (async () => {
      const local = await loadTrip(key);
      const localTrip = local ? migrate(local) : null;
      let base = localTrip || freshDefault();
      if (alive) apply(base);
      try {
        const remote = await pullRemote(key);
        if (remote) {
          remoteRef.current = remote;
          // IMPORTANT: never merge the freshDefault sample into an existing
          // cloud trip — that injected duplicate sample days/items every fresh
          // session. Only merge when there are genuine local edits.
          base = localTrip ? mergeTrip(localTrip, remote) : normalizeTrip(remote);
          // heal duplicate days/flights/checklist items from earlier sessions
          if (alive) apply(base);
          await saveTrip(key, base, { dirty: false });
        } else {
          // brand-new trip (no local, no remote): seed sample + create cloud row
          await saveTrip(key, base, { dirty: false });
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
      applyRemote(merged); // keep the field the user is editing (F-05)
    });
  }, [key, clientId]);

  // ---- clear pending timers on unmount ----
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

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
  const setTravelers = (travelers) => commit({ ...d(), travelers: { v: travelers, updatedAt: now() } });

  const listAdd = (field, item) =>
    commit({ ...d(), [field]: [...d()[field], { id: uid(), updatedAt: now(), ...item }] });
  const listUpdate = (field, id, patch) =>
    commit({ ...d(), [field]: d()[field].map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)) });
  const listDelete = (field, id) =>
    commit({ ...d(), [field]: d()[field].map((x) => (x.id === id ? { ...x, _deleted: true, updatedAt: now() } : x)) });

  const dayMutate = (dayId, fn) =>
    commit({ ...d(), days: d().days.map((day) => (day.id === dayId ? { ...day, ...fn(day), updatedAt: now() } : day)) });

  // ---- v3 口袋地點 (F-72/73/75/78) ----
  // All of these ride the existing commit() pipeline. The feature adds no sync
  // machinery of its own.
  const newPocket = (pocket, t) => ({
    id: uid(), title: "", sourceUrl: "", platform: "other", summary: "",
    rawText: "", pending: false, createdAt: t, updatedAt: t, ...pocket,
  });
  const newPlaces = (places, pocketId, t, from = 0) =>
    places.map((p, i) => ({
      id: uid(), pocketId, name: "", nameJa: "", category: "other", area: "",
      note: "", lat: null, lng: null, geoSource: "", photoUrl: "",
      order: from + i, updatedAt: t, ...p,
    }));

  const mutators = {
    setField,
    setTravelers,
    // flights
    addFlight: (f) => listAdd("flights", f),
    updateFlight: (id, patch) => listUpdate("flights", id, patch),
    deleteFlight: (id) => listDelete("flights", id),
    // days
    addDays: (newDays) => commit({ ...d(), days: [...d().days, ...newDays] }),
    // city/lodging are mergeable scalars, each with its own updatedAt, so two
    // editors can change different fields of the same day without clobbering.
    setDayField: (id, field, value) =>
      commit({ ...d(), days: d().days.map((x) => (x.id === id ? { ...x, [field]: { v: value, updatedAt: now() } } : x)) }),
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
    updateCheck: (field, id, patch) => listUpdate(field, id, patch),
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

    // ---- pockets / places (v3) ----
    // F-72's only write path. The pocket and its N places go in ONE commit: two
    // commits would leave a window where the trip has a pocket and no places,
    // and a realtime push landing in that window merges the half-written state
    // out to everyone. Same reasoning for resolvePocket and deletePocket.
    addPocketWithPlaces: (pocket, places = []) => {
      const t = now();
      const rec = newPocket(pocket, t);
      const recs = newPlaces(places, rec.id, t);
      commit({ ...d(), pockets: [...d().pockets, rec], places: [...d().places, ...recs] });
      return { pocketId: rec.id, placeIds: recs.map((r) => r.id) };
    },

    // F-78: offline stash, or an empty pocket created by hand.
    addPocket: (pocket) => {
      const t = now();
      const rec = newPocket(pocket, t);
      commit({ ...d(), pockets: [...d().pockets, rec] });
      return rec.id;
    },

    // C-23's explicit save button. `patch` carries only what the user changed.
    updatePlace: (id, patch) =>
      commit({ ...d(), places: d().places.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)) }),

    // F-78: a pending pocket parsed successfully — promote it and attach its
    // places, in one commit.
    resolvePocket: (pocketId, pocket, places = []) => {
      const t = now();
      const recs = newPlaces(places, pocketId, t);
      commit({
        ...d(),
        pockets: d().pockets.map((x) =>
          x.id === pocketId ? { ...x, pending: false, ...pocket, updatedAt: t } : x),
        places: [...d().places, ...recs],
      });
      return recs.map((r) => r.id);
    },

    // Compact tombstone { id, _deleted, updatedAt } instead of the generic
    // listDelete's flattened record: ~58B against ~377B, and nothing ever reads
    // a tombstone's fields (liveItems filters them before render). pick() still
    // lets it win — a strictly newer updatedAt, and _deleted wins ties.
    deletePlace: (id) =>
      commit({ ...d(), places: d().places.map((x) => (x.id === id ? { id, _deleted: true, updatedAt: now() } : x)) }),

    // Tombstone the pocket AND its live places together, or we leave orphan
    // places pointing at a deleted pocket: invisible in the UI, still counted
    // against the 1MB budget.
    deletePocket: (pocketId) => {
      const t = now();
      commit({
        ...d(),
        pockets: d().pockets.map((x) => (x.id === pocketId ? { id: x.id, _deleted: true, updatedAt: t } : x)),
        places: d().places.map((x) =>
          x.pocketId === pocketId && !x._deleted ? { id: x.id, _deleted: true, updatedAt: t } : x),
      });
    },

    // F-75. One commit writes the item AND its placeId, so the itinerary entry
    // and the 「已加入 D2」 badge (which is a reverse lookup over exactly this
    // field) can never disagree.
    addPlaceToDay: (dayId, place) => {
      const t = now();
      const itemId = uid();
      commit({
        ...d(),
        days: d().days.map((day) => {
          if (day.id !== dayId) return day;
          return {
            ...day,
            updatedAt: t,
            items: [...day.items, {
              id: itemId,
              order: day.items.filter((i) => !i._deleted).length, // same as addItem
              time: "",
              mapUrl: "",
              ...placeToItem(place), // title / type / note / placeId
              updatedAt: t,
            }],
          };
        }),
      });
      return itemId;
    },
  };

  return { key, clientId, lsAvailable, data, syncState, pending, retry, focusField, blurField, ...mutators };
}
