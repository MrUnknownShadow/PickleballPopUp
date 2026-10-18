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

      setUsername(trimmed);
      localStorage.setItem('pb_username', trimmed);
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
    localStorage.removeItem('pb_username');
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
    []
  );

  return (
    <AuthContext.Provider
      value={{
        username,
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