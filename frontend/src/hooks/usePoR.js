import { useState, useEffect, useCallback } from "react";
import { fetchReserves, fetchSystem } from "../api.js";

const POLL_INTERVAL = 10_000; // 10초

export function usePoR() {
  const [reserves, setReserves]   = useState(null);
  const [system,   setSystem]     = useState(null);
  const [history,  setHistory]    = useState([]); // 시계열 기록 (최대 30개)
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const [lastPoll, setLastPoll]   = useState(null);

  const poll = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([fetchReserves(), fetchSystem()]);
      setReserves(r.assets);
      setSystem(s);
      setLastPoll(new Date());
      setError(null);

      // 히스토리에 스냅샷 추가 (ratio 기록용)
      setHistory(prev => {
        const snap = {
          time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          ...Object.fromEntries(
            Object.entries(r.assets).map(([k, v]) => [k, parseFloat(v.ratioPct || 0)])
          ),
        };
        return [...prev.slice(-29), snap];
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  return { reserves, system, history, loading, error, lastPoll, refetch: poll };
}
