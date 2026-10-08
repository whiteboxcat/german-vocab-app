// Load the word list one CEFR level at a time: Supabase if a publishable key is set, otherwise the
// public GitHub data. Each level is cached on the device with the data_version, so the app works
// offline and only downloads again when the data changed.

import { DATA_FALLBACK_BASE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { Noun, Verb, Word } from '../engine/types';
import { readJSON, writeJSON } from './storage';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const cacheKey = (level: string) => `words-cache-v2-${level}`;
type Cache = { version: number; words: Word[]; savedAt: number };

export type LoadResult = { words: Word[]; version: number; offline: boolean };

let supabaseFailed = false;
const useSupabase = () => SUPABASE_PUBLISHABLE_KEY.length > 0 && !supabaseFailed;

async function getJSON(url: string, headers: Record<string, string> = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    if (!r.ok) throw Object.assign(new Error(`${r.status} ${url}`), { status: r.status });
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const sbHeaders = () => ({ apikey: SUPABASE_PUBLISHABLE_KEY });
const typed = (nouns: Noun[], verbs: Verb[]): Word[] => [
  ...nouns.map((n) => ({ ...n, type: 'noun' as const })),
  ...verbs.map((v) => ({ ...v, type: 'verb' as const })),
];

async function remoteVersion(): Promise<number> {
  if (useSupabase()) {
    const rows = await getJSON(`${SUPABASE_URL}/rest/v1/meta?key=eq.data_version&select=value`, sbHeaders());
    return Number(rows?.[0]?.value ?? 0);
  }
  const meta = await getJSON(`${DATA_FALLBACK_BASE}/meta.json?t=${Date.now()}`);
  return Number(meta?.data_version ?? 0);
}

async function supabaseLevel<T>(table: 'nouns' | 'verbs', level: string): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const rows: { data: T }[] = await getJSON(
      `${SUPABASE_URL}/rest/v1/${table}?select=data&level=eq.${level}&order=id&limit=${page}&offset=${offset}`,
      sbHeaders());
    out.push(...rows.map((r) => r.data));
    if (rows.length < page) return out;
  }
}

async function githubLevel(level: string): Promise<Word[]> {
  const bust = `?t=${Date.now()}`;
  try {
    const [nouns, verbs] = await Promise.all([
      getJSON(`${DATA_FALLBACK_BASE}/levels/${level}/nouns.json${bust}`).catch((e) => (e.status === 404 ? [] : Promise.reject(e))),
      getJSON(`${DATA_FALLBACK_BASE}/levels/${level}/verbs.json${bust}`).catch((e) => (e.status === 404 ? [] : Promise.reject(e))),
    ]);
    if (nouns.length || verbs.length) return typed(nouns, verbs);
  } catch {}
  // Older single-file layout (before the data was split by level).
  const [nouns, verbs]: [Noun[], Verb[]] = await Promise.all([
    getJSON(`${DATA_FALLBACK_BASE}/nouns.json${bust}`).catch(() => []),
    getJSON(`${DATA_FALLBACK_BASE}/verbs.json${bust}`).catch(() => []),
  ]);
  return typed(nouns.filter((n) => n.level === level), verbs.filter((v) => v.level === level));
}

async function remoteLevel(level: string): Promise<Word[]> {
  if (useSupabase()) {
    const [nouns, verbs] = await Promise.all([supabaseLevel<Noun>('nouns', level), supabaseLevel<Verb>('verbs', level)]);
    return typed(nouns, verbs);
  }
  return githubLevel(level);
}

async function freshLevels(levels: string[]): Promise<LoadResult> {
  const version = await remoteVersion();
  const words: Word[] = [];
  for (const level of levels) {
    const cache = await readJSON<Cache>(cacheKey(level));
    if (cache && cache.version === version) {
      words.push(...cache.words);
      continue;
    }
    const lw = await remoteLevel(level);
    await writeJSON(cacheKey(level), { version, words: lw, savedAt: Date.now() } satisfies Cache);
    words.push(...lw);
  }
  if (!words.length) throw new Error('empty word list');
  return { words, version, offline: false };
}

/** Words of the given CEFR levels. */
export async function loadWords(levels: string[]): Promise<LoadResult> {
  try {
    try {
      return await freshLevels(levels);
    } catch (e) {
      if (!useSupabase()) throw e;
      supabaseFailed = true; // Supabase unreachable or empty: use the public GitHub copy instead
      return await freshLevels(levels);
    }
  } catch (e) {
    const cached: Word[] = [];
    let version = 0;
    for (const level of levels) {
      const c = await readJSON<Cache>(cacheKey(level));
      if (c) { cached.push(...c.words); version = c.version; }
    }
    if (cached.length) return { words: cached, version, offline: true };
    throw e;
  }
}

/** How many words each level has (from the data's meta), for the progress list. */
export async function levelTotals(): Promise<Record<string, number>> {
  try {
    const row = useSupabase()
      ? (await getJSON(`${SUPABASE_URL}/rest/v1/meta?key=eq.counts_by_level&select=value`, sbHeaders()))?.[0]?.value
      : (await getJSON(`${DATA_FALLBACK_BASE}/meta.json`))?.counts_by_level;
    const out: Record<string, number> = {};
    for (const [lvl, c] of Object.entries((row ?? {}) as Record<string, { nouns: number; verbs: number }>)) {
      out[lvl] = (c.nouns ?? 0) + (c.verbs ?? 0);
    }
    return out;
  } catch {
    return {};
  }
}
