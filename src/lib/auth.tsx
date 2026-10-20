import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { StaffMember, Workspace } from './types';

interface AuthState {
  session: Session | null;
  user: User | null;
  staff: StaffMember | null;
  workspace: Workspace | null;
  loading: boolean;
  workspaceError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('already registered')) return 'An account with this email already exists. Try signing in.';
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.';
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Please enter a valid email address.';
  if (m.includes('email not confirmed')) return 'This account is not confirmed yet.';
  return GENERIC_ERROR;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const lookupVersion = useRef(0);

  const loadWorkspaceData = useCallback(async (userId: string) => {
    const version = ++lookupVersion.current;
    setLoading(true);
    setWorkspaceError(null);
    try {
      const { data: staffRow, error: staffError } = await supabase
        .from('staff').select('*').eq('id', userId).maybeSingle();
      if (version !== lookupVersion.current) return;
      if (staffError) throw new Error('Could not read your team membership. Please retry.');
      if (!staffRow) {
        setStaff(null);
        setWorkspace(null);
        return;
      }

      const { data: wsRow, error: wsError } = await supabase
        .from('workspaces').select('*').eq('id', staffRow.workspace_id).maybeSingle();
      if (version !== lookupVersion.current) return;
      if (wsError || !wsRow) throw new Error('Could not load your workspace. Please retry.');
      // Publish staff and workspace together so routing never sees a half-loaded identity.
      setStaff(staffRow as StaffMember);
      setWorkspace(wsRow as Workspace);
    } catch (error) {
      if (version === lookupVersion.current) {
        setWorkspaceError(error instanceof Error ? error.message : 'Workspace lookup failed. Please retry.');
      }
    } finally {
      if (version === lookupVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Keep the session listener synchronous; run database reads outside
    // Supabase's auth callback to avoid blocking token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
      if (event === 'SIGNED_OUT' || !newSession) {
        ++lookupVersion.current;
        setStaff(null);
        setWorkspace(null);
        setWorkspaceError(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void loadWorkspaceData(newSession.user.id);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setWorkspaceError('Session verification failed. Please sign in again.');
        setLoading(false);
        return;
      }
      setSession(data.session);
      if (data.session?.user) {
        void loadWorkspaceData(data.session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setWorkspaceError('Could not verify your session. Please retry.');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      ++lookupVersion.current;
      sub.subscription.unsubscribe();
    };
  }, [loadWorkspaceData]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStaff(null);
    setWorkspace(null);
    ++lookupVersion.current;
    setWorkspaceError(null);
    setSession(null);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      await loadWorkspaceData(data.session.user.id);
    } else {
      setWorkspaceError('Session expired. Please sign in again.');
    }
  }, [loadWorkspaceData]);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    staff,
    workspace,
    loading,
    workspaceError,
    signIn,
    signUp,
    signOut,
    refreshWorkspace,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
