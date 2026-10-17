import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { StaffMember, Workspace } from './types';

interface AuthState {
  session: Session | null;
  user: User | null;
  staff: StaffMember | null;
  workspace: Workspace | null;
  loading: boolean;
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

  const loadWorkspaceData = useCallback(async (userId: string) => {
    const { data: staffRow, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (staffError || !staffRow) {
      setStaff(null);
      setWorkspace(null);
      return;
    }
    setStaff(staffRow as StaffMember);

    const { data: wsRow, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', staffRow.workspace_id)
      .maybeSingle();

    if (wsError || !wsRow) {
      setWorkspace(null);
      return;
    }
    setWorkspace(wsRow as Workspace);
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadWorkspaceData(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT') {
        setStaff(null);
        setWorkspace(null);
        setLoading(false);
      }
      if (newSession?.user && event === 'SIGNED_IN') {
        (async () => {
          await loadWorkspaceData(newSession.user.id);
        })();
      }
    });

    return () => {
      cancelled = true;
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
    setSession(null);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      await loadWorkspaceData(data.session.user.id);
    }
  }, [loadWorkspaceData]);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    staff,
    workspace,
    loading,
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
