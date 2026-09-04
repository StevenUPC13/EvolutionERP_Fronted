import { useCallback, useState } from 'react';

type Session = { token: string; username: string; sociedades: string[]; sociedadActual: string };

export function useSession() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem('evo_session');
    return saved ? JSON.parse(saved) as Session : null;
  });

  const saveSession = useCallback((next: Session) => {
    localStorage.setItem('evo_session', JSON.stringify(next));
    if (next.token) localStorage.setItem('evo_token', next.token);
    setSession(next);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('evo_session');
    localStorage.removeItem('evo_token');
    setSession(null);
  }, []);

  return { session, saveSession, clearSession, isAuthenticated: Boolean(localStorage.getItem('evo_token')) };
}
