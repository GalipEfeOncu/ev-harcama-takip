"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccountSnapshot } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function RestoreAccount() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    void getAccountSnapshot().then((account) => {
      if (active && account) router.replace("/dashboard");
    }).catch(() => {
      // A temporary network failure must not erase the saved session.
    });
    return () => { active = false; };
  }, [router]);

  return null;
}
