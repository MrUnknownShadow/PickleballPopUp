import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';

const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface AuthContextType {
  username: string | null;
  isAdmin: boolean;
  login: (name: string, pin: string) => Promise<void>;
  register: (name: string, pin: string, phoneNumber: string, smsOptIn: boolean) => Promise<void>;
  logout: () => void;
  apiFetch: <T = unknown>(
    path: string,
    options?: RequestInit
  ) => Promise<T>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [username, setUsername] = useState<string | null>(
    () => localStorage.getItem('pb_username')
  );

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('pb_token')
  );
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => localStorage.getItem('pb_admin') === '1'
  );

  const authenticate = useCallback(
    async (
      endpoint: 'login' | 'register',
      name: string,
      pin: string,
      phoneNumber = '',
      smsOptIn = false
    ) => {
      const trimmed = name.trim().toLowerCase();

      const res = await fetch(
        `${API_BASE}/api/users/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: trimmed,
            pin,
            phoneNumber,
            smsOptIn,
          }),
        }
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };

        throw new Error(
          err.error ?? 'Authentication failed'
        );
      }

      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        isAdmin?: boolean;
      };
      setUsername(trimmed);
      setToken(data.token ?? null);
      setIsAdmin(data.isAdmin === true);
      localStorage.setItem('pb_username', trimmed);
      if (data.token) localStorage.setItem('pb_token', data.token);
      else localStorage.removeItem('pb_token');
      localStorage.setItem('pb_admin', data.isAdmin ? '1' : '0');
    },
    []
  );

  const login = useCallback(
    async (name: string, pin: string) => {
      await authenticate('login', name, pin);
    },
    [authenticate]
  );

  const register = useCallback(
    async (name: string, pin: string, phoneNumber: string, smsOptIn: boolean) => {
      await authenticate('register', name, pin, phoneNumber, smsOptIn);
    },
    [authenticate]
  );

  const logout = useCallback(() => {
    setUsername(null);
    setToken(null);
    setIsAdmin(false);
    localStorage.removeItem('pb_username');
    localStorage.removeItem('pb_token');
    localStorage.removeItem('pb_admin');
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(
      path: string,
      options: RequestInit = {}
    ): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      if (!res.ok) {
        const err = (await res
          .json()
          .catch(() => ({}))) as {
          error?: string;
        };

        throw new Error(
          err.error ?? 'Request failed'
        );
      }

      return res.json() as Promise<T>;
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        username,
        isAdmin,
        login,
        register,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}