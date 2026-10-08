// Load the word list: Supabase if a publishable key is set, otherwise the public GitHub data.
// Cached on the device with its data_version, so the app works offline and only downloads when it changed.

import { DATA_FALLBACK_BASE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { Noun, Verb, Word } from '../engine/types';
import { readJSON, writeJSON } from './storage';

const CACHE_KEY = 'words-cache-v1';
type Cache = { version: number; words: Word[]; savedAt: number };

export type LoadResult = { words: Word[]; version: number; offline: boolean };

let supabaseFailed = false;
const useSupabase = () => SUPABASE_PUBLISHABLE_KEY.length > 0 && !supabaseFailed;

async function getJSON(url: string, headers: Record<string, string> = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const sbHeaders = () => ({ apikey: SUPABASE_PUBLISHABLE_KEY });

async function remoteVersion(): Promise<number> {
  if (useSupabase()) {
    const rows = await getJSON(`${SUPABASE_URL}/rest/v1/meta?key=eq.data_version&select=value`, sbHeaders());
    return Number(rows?.[0]?.value ?? 0);
  }
  const meta = await getJSON(`${DATA_FALLBACK_BASE}/meta.json?t=${Date.now()}`);
  return Number(meta?.data_version ?? 0);
}

async function supabaseTable<T>(table: 'nouns' | 'verbs'): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const rows: { data: T }[] = await getJSON(
      `${SUPABASE_URL}/rest/v1/${table}?select=data&order=id&limit=${page}&offset=${offset}`, sbHeaders());
    out.push(...rows.map((r) => r.data));
    if (rows.length < page) return out;
  }
}

async function remoteWords(): Promise<Word[]> {
  let nouns: Noun[];
  let verbs: Verb[];
  if (useSupabase()) {
    [nouns, verbs] = await Promise.all([supabaseTable<Noun>('nouns'), supabaseTable<Verb>('verbs')]);
  } else {
    const bust = `?t=${Date.now()}`;
    [nouns, verbs] = await Promise.all([
      getJSON(`${DATA_FALLBACK_BASE}/nouns.json${bust}`), getJSON(`${DATA_FALLBACK_BASE}/verbs.json${bust}`),
    ]);
  }
  return [
    ...nouns.map((n) => ({ ...n, type: 'noun' as const })),
    ...verbs.map((v) => ({ ...v, type: 'verb' as const })),
  ];
}

async function fetchFresh(cache: Cache | null): Promise<LoadResult> {
  const version = await remoteVersion();
  if (cache && cache.version === version && cache.words.length) {
    return { words: cache.words, version, offline: false };
  }
  const words = await remoteWords();
  if (!words.length) throw new Error('empty word list');
  await writeJSON(CACHE_KEY, { version, words, savedAt: Date.now() } satisfies Cache);
  return { words, version, offline: false };
}

export async function loadWords(): Promise<LoadResult> {
  const cache = await readJSON<Cache>(CACHE_KEY);
  try {
    try {
      return await fetchFresh(cache);
    } catch (e) {
      if (!useSupabase()) throw e;
      supabaseFailed = true; // Supabase unreachable or empty: use the public GitHub copy instead
      return await fetchFresh(cache);
    }
  } catch (e) {
    if (cache?.words.length) return { words: cache.words, version: cache.version, offline: true };
    throw e;
  }
}
