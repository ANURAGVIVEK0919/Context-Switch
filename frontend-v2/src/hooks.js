import { useState, useEffect, useCallback } from 'react';

/**
 * Generic data-fetching hook.
 * Usage: const { data, loading, error, refetch } = useApi(fetchFn, deps)
 */
export function useApi(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (e) {
      setError(e.message || 'Request failed');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}

/**
 * Auto-polling hook — refreshes every `intervalMs` ms.
 */
export function usePolling(fetchFn, intervalMs = 5000, deps = []) {
  const result = useApi(fetchFn, deps);

  useEffect(() => {
    const id = setInterval(result.refetch, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return result;
}
