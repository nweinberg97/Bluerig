'use client';

// Customer requests from the website form. Read and marked handled straight from
// the database; the existing row-level security lets only the shop's own team do it.

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

export interface Lead {
  id: number;
  name: string;
  phone: string | null;
  town: string | null;
  message: string;
  urgency: 'now' | 'soon' | 'quote';
  handled: boolean;
  created_at: string;
}

export function useLeads(businessId: string, refreshMs = 0) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await browserClient()
      .from('leads')
      .select('id, name, phone, town, message, urgency, handled, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50);
    setLeads((data as Lead[] | null) ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    void reload();
    if (!refreshMs) return;
    const t = setInterval(() => void reload(), refreshMs);
    return () => clearInterval(t);
  }, [reload, refreshMs]);

  const markHandled = useCallback(
    async (id: number) => {
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, handled: true } : l)));
      await browserClient().from('leads').update({ handled: true }).eq('id', id);
      void reload();
    },
    [reload],
  );

  return { leads, loading, reload, markHandled, newCount: leads.filter((l) => !l.handled).length };
}
