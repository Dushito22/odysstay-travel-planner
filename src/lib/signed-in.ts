import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/** Whether someone is signed in, on the client. null until known, so nothing flickers on the server render. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}
