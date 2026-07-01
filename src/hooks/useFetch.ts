import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchOptions<T> {
  url: string;
  method?: string;
  body?: any;
  pollingInterval?: number; // en milisegundos
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  executeOnMount?: boolean;
}

export function useFetch<T = any>({
  url,
  method = 'GET',
  body,
  pollingInterval,
  onSuccess,
  onError,
  executeOnMount = true
}: UseFetchOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(executeOnMount);
  const [error, setError] = useState<Error | null>(null);

  // Usar refs para los callbacks para evitar que causen re-renders e infinite loops
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  // Usar refs para url, method, body para que no causen re-renders
  const urlRef = useRef(url);
  const methodRef = useRef(method);
  const bodyRef = useRef(body);
  urlRef.current = url;
  methodRef.current = method;
  bodyRef.current = body;

  const execute = useCallback(async (overrideBody?: any) => {
    setLoading(true);
    setError(null);
    try {
      const fetchOptions: RequestInit = {
        method: methodRef.current,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const requestBody = overrideBody !== undefined ? overrideBody : bodyRef.current;
      if (requestBody && methodRef.current !== 'GET') {
        fetchOptions.body = JSON.stringify(requestBody);
      }

      const response = await fetch(urlRef.current, fetchOptions);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Error en la petición');
      }

      setData(json);
      if (onSuccessRef.current) onSuccessRef.current(json);
      return json;
    } catch (err: any) {
      setError(err);
      if (onErrorRef.current) onErrorRef.current(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []); // Sin dependencias — los valores se leen desde refs

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval>;

    if (executeOnMount && methodRef.current === 'GET') {
      execute().catch(() => {});
    }

    if (pollingInterval && methodRef.current === 'GET') {
      intervalId = setInterval(() => {
        if (mounted) execute().catch(() => {});
      }, pollingInterval);
    }

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [execute, executeOnMount, pollingInterval]); // execute es estable ahora (sin deps)

  return { data, loading, error, execute, setData };
}
