import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

type QueryResponse<T = unknown> = {
  data: T | null;
  error: null;
};

type QueryBuilder<T = unknown> = {
  select: (...args: unknown[]) => QueryBuilder<T>;
  eq: (...args: unknown[]) => QueryBuilder<T>;
  neq: (...args: unknown[]) => QueryBuilder<T>;
  order: (...args: unknown[]) => QueryBuilder<T>;
  limit: (...args: unknown[]) => QueryBuilder<T>;
  insert: (...args: unknown[]) => QueryBuilder<T>;
  update: (...args: unknown[]) => QueryBuilder<T>;
  delete: (...args: unknown[]) => QueryBuilder<T>;
  maybeSingle: () => Promise<QueryResponse<T>>;
  single: () => Promise<QueryResponse<T>>;
  then: Promise<QueryResponse<T>>['then'];
};

const createEmptyQuery = <T = unknown>(): QueryBuilder<T> => {
  const response: QueryResponse<T> = { data: null, error: null };
  const query: QueryBuilder<T> = {
    select: () => query,
    eq: () => query,
    neq: () => query,
    order: () => query,
    limit: () => query,
    insert: () => query,
    update: () => query,
    delete: () => query,
    maybeSingle: async () => response,
    single: async () => response,
    then: (onFulfilled, onRejected) => Promise.resolve(response).then(onFulfilled, onRejected),
  };

  return query;
};

const createFallbackSupabase = () => ({
  from: () => createEmptyQuery(),
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: null }),
    }),
  },
});

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    })
  : (createFallbackSupabase() as unknown as SupabaseClient);

export const STORAGE_BUCKET = 'report-photos';
