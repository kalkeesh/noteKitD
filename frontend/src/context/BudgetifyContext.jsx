import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getBudgetSummary } from '../features/budgetify/api';
import { useAuth } from './AuthContext';
import { loadCachedData, saveCachedData } from '../config/offlineCache';

const BudgetifyContext = createContext({
  month: 0,
  year: 0,
  summary: null,
  loading: false,
  error: '',
  setPeriod: () => {},
  refreshSummary: async () => {},
});

export function BudgetifyProvider({ children }) {
  const { session } = useAuth();
  const token = session?.token || '';
  const userCacheKey = session?.email || session?.name || 'current-user';
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshSummary = useCallback(
    async (nextMonth = month, nextYear = year) => {
      if (!token) {
        setSummary(null);
        setError('');
        return null;
      }

      try {
        setLoading(true);
        setError('');
        const cacheName = `budget_summary_${nextYear}_${nextMonth}`;
        const cached = await loadCachedData(userCacheKey, cacheName, null);
        if (cached) {
          setSummary(cached);
          setLoading(false);
        }
        const data = await getBudgetSummary(token, nextMonth, nextYear);
        setSummary(data);
        await saveCachedData(userCacheKey, cacheName, data);
        return data;
      } catch (err) {
        const cacheName = `budget_summary_${nextYear}_${nextMonth}`;
        const cached = await loadCachedData(userCacheKey, cacheName, null);
        if (cached) {
          setSummary(cached);
          setError('Showing saved Budgetify data while the backend wakes up.');
          return cached;
        }
        setError(err?.message || 'Unable to load Budgetify summary.');
        setSummary(null);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [month, token, userCacheKey, year]
  );

  useEffect(() => {
    refreshSummary().catch(() => {});
  }, [refreshSummary]);

  const value = useMemo(
    () => ({
      month,
      year,
      summary,
      loading,
      error,
      setPeriod(nextMonth, nextYear) {
        setMonth(nextMonth);
        setYear(nextYear);
      },
      refreshSummary,
    }),
    [error, loading, month, refreshSummary, summary, year]
  );

  return <BudgetifyContext.Provider value={value}>{children}</BudgetifyContext.Provider>;
}

export function useBudgetify() {
  return useContext(BudgetifyContext);
}
