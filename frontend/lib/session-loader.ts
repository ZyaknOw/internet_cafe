import type { Session, SupabaseClient } from "@supabase/supabase-js";

export const SESSION_LOAD_ERROR = "We couldn't load your account. Check your connection and try again.";

// Keep network work outside Supabase's auth-event callback. A deadline also
// covers session restoration when INITIAL_SESSION never arrives.
export function subscribeToSession<Profile>(
  auth: Pick<SupabaseClient["auth"], "onAuthStateChange">,
  fetchProfile: (session: Session) => Promise<Profile | null>,
  onLoaded: (session: Session | null, profile: Profile | null) => void,
  onError: (message: string) => void,
  timeoutMs = 15_000,
) {
  let disposed = false;
  let version = 0;
  let deferred: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout>;

  const fail = () => {
    version += 1;
    clearTimeout(deferred);
    onError(SESSION_LOAD_ERROR);
  };
  deadline = setTimeout(fail, timeoutMs);

  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
    if (disposed) return;
    const requestVersion = ++version;
    clearTimeout(deferred);
    clearTimeout(deadline);
    if (!session) {
      onLoaded(null, null);
      return;
    }

    deadline = setTimeout(fail, timeoutMs);
    deferred = setTimeout(() => {
      void (async () => {
        try {
          const profile = await fetchProfile(session);
          if (disposed || requestVersion !== version) return;
          clearTimeout(deadline);
          if (!profile) {
            onError(SESSION_LOAD_ERROR);
            return;
          }
          onLoaded(session, profile);
        } catch {
          if (disposed || requestVersion !== version) return;
          clearTimeout(deadline);
          onError(SESSION_LOAD_ERROR);
        }
      })();
    }, 0);
  });

  return () => {
    disposed = true;
    version += 1;
    clearTimeout(deferred);
    clearTimeout(deadline);
    subscription.unsubscribe();
  };
}
