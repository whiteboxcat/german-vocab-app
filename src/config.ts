// Where the word data comes from.
// The publishable key is safe to ship in the app: the database only allows reading with it.
export const SUPABASE_URL = 'https://aqcjpwtxfidofujgxuxl.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Fk7P_Fl60eqNKy9lnBqNmw_lBjO_emB';

// Fallback: the same data straight from the public data repository.
export const DATA_FALLBACK_BASE =
  'https://raw.githubusercontent.com/whiteboxcat/german-vocab-data/main/data';

export const CREDIT = 'Word data: Netzverb (www.verbformen.de), CC BY-SA 4.0';
export const CREDIT_URL = 'https://www.verbformen.de/';
