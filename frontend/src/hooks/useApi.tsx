import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T = unknown>(path: string): UseApiResult<T> {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<T>(path);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [path, apiFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

interface Notification {
  message: string;
  type: string;
}

interface UseNotificationResult {
  show: (message: string, type?: string) => void;
  Notification: ReactNode;
}

export function useNotification(): UseNotificationResult {
  const [notif, setNotif] = useState<Notification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, type = 'default') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNotif({ message, type });
    timerRef.current = setTimeout(() => setNotif(null), 3000);
  }, []);

  const NotificationEl: ReactNode = notif ? (
    <div className={`notification ${notif.type}`} role={notif.type === 'error' ? 'alert' : 'status'}>{notif.message}</div>
  ) : null;

  return { show, Notification: NotificationEl };
}
