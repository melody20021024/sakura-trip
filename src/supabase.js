import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True when both build-time env vars are present. The app is local-first, so it
// must still load (and just run offline) if cloud config is missing or wrong —
// hence the harmless placeholder below, which keeps createClient from throwing
// at import time and white-screening the whole app. Sync calls then simply fail
// and useTrip's catch handlers settle syncState to "failed"/"offline".
export const cloudEnabled = Boolean(url && key);

export const supabase = createClient(
  url || "https://unconfigured.invalid",
  key || "unconfigured-anon-key"
);
