import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, Organization, SignUpHRInput, SignInInput } from '@shortlistiq/shared';
import { apiClient, tokenStorage, ApiError } from '../lib/api.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

interface AuthContextValue {
  profile: Profile | null;
  organization: Organization | null;
  token: string | null;
  isLoading: boolean;
  signIn: (credentials: SignInInput) => Promise<void>;
  signUpHR: (data: SignUpHRInput) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'azure') => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    const existingToken = tokenStorage.get();
    if (!existingToken) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiClient<{
        success: boolean;
        data: { profile: Profile; organization: Organization | null };
      }>('/api/v1/auth/me', { requiresAuth: true });

      if (res.success && res.data) {
        setProfile(res.data.profile);
        setOrganization(res.data.organization);
      } else {
        tokenStorage.clear();
        setToken(null);
        setProfile(null);
        setOrganization(null);
      }
    } catch (err) {
      tokenStorage.clear();
      setToken(null);
      setProfile(null);
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      fetchCurrentUser();
      return;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        try {
          const res = await apiClient<{
            success: boolean;
            data: { profile: Profile; organization: Organization | null; token: string };
          }>('/api/v1/auth/oauth-sync', {
            method: 'POST',
            body: JSON.stringify({
              id: session.user.id,
              email: session.user.email,
              fullName:
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                'HR Recruiter'
            }),
            requiresAuth: false
          });

          if (res.success && res.data) {
            tokenStorage.set(res.data.token);
            setToken(res.data.token);
            setProfile(res.data.profile);
            setOrganization(res.data.organization);
          }
        } catch (err) {
          console.error('Failed to sync OAuth user:', err);
          fetchCurrentUser();
        } finally {
          setIsLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        tokenStorage.clear();
        setToken(null);
        setProfile(null);
        setOrganization(null);
        setIsLoading(false);
      } else {
        fetchCurrentUser();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchCurrentUser]);

  const signUpHR = async (data: SignUpHRInput) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
              role: 'hr',
              organization_name: data.organizationName
            }
          }
        });
        if (signUpError) throw new ApiError('AUTH_ERROR', signUpError.message);
      }

      // Complete profile & org creation in the API
      const res = await apiClient<{
        success: boolean;
        data: { profile: Profile; organization: Organization; token: string };
      }>('/api/v1/auth/signup-hr', {
        method: 'POST',
        body: JSON.stringify(data),
        requiresAuth: false
      });

      if (res.success && res.data) {
        tokenStorage.set(res.data.token);
        setToken(res.data.token);
        setProfile(res.data.profile);
        setOrganization(res.data.organization);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (credentials: SignInInput) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password
        });
        if (signInError) throw new ApiError('AUTH_ERROR', signInError.message);
      }

      const res = await apiClient<{
        success: boolean;
        data: { profile: Profile; organization: Organization | null; token: string };
      }>('/api/v1/auth/signin', {
        method: 'POST',
        body: JSON.stringify(credentials),
        requiresAuth: false
      });

      if (res.success && res.data) {
        tokenStorage.set(res.data.token);
        setToken(res.data.token);
        setProfile(res.data.profile);
        setOrganization(res.data.organization);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut().catch(() => null);
      }
      tokenStorage.clear();
      setToken(null);
      setProfile(null);
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithOAuth = async (provider: 'google' | 'azure') => {
    if (!isSupabaseConfigured) {
      throw new ApiError(
        'CONFIG_REQUIRED',
        `Supabase credentials required to enable ${provider === 'google' ? 'Google' : 'Microsoft'} OAuth.`
      );
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/hr/dashboard`
      }
    });

    if (error) {
      throw new ApiError('OAUTH_ERROR', error.message);
    }
  };

  const resetPasswordForEmail = async (email: string) => {
    if (!isSupabaseConfigured) {
      throw new ApiError(
        'CONFIG_REQUIRED',
        'Supabase configuration is required to dispatch password reset emails.'
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`
    });

    if (error) {
      throw new ApiError('AUTH_ERROR', error.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        organization,
        token,
        isLoading,
        signIn,
        signUpHR,
        signOut,
        signInWithOAuth,
        resetPasswordForEmail
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

