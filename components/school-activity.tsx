'use client';
import { useCallback, useRef, useState } from 'react';
import { schoolApi } from '@/lib/backend';

export function useActivityRecorder() {
  const pending = useRef(new Map<string, Record<string, unknown>>());
  const [failed, setFailed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const save = useCallback(async (entry: Record<string, unknown>) => {
    const id = entry.requestId as string;
    try { await schoolApi(entry); pending.current.delete(id); }
    catch { pending.current.set(id, entry); }
    setFailed(pending.current.size);
  }, []);
  const record = useCallback((kind: 'solve' | 'practice', equation: string, answer?: string) => {
    if (!equation.trim() || equation.length > 240) return;
    void save({ action: 'record', requestId: crypto.randomUUID(), kind, equation, answer });
  }, [save]);
  async function retry() {
    setRetrying(true);
    for (const entry of pending.current.values()) await save(entry);
    setRetrying(false);
  }
  const notice = failed > 0 ? <output className="school-save-notice"><span>{failed} {failed === 1 ? 'activity hasn’t' : 'activities haven’t'} been saved to your school account yet. Retry before leaving this page.</span><button disabled={retrying} onClick={() => { void retry(); }}>{retrying ? 'Saving…' : 'Retry saving'}</button></output> : null;
  return { record, notice };
}
