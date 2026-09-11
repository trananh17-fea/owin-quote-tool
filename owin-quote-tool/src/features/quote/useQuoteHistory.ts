import { useEffect, useMemo, useRef, useState } from 'react';
import type { QuoteRecord } from '@/types/models';
import { getAllQuotes } from '@/features/quote/quoteStore';
import { subscribeToQuotes } from '@/services/supabase/quotesRepo';
import { operationError } from '@/features/quote/quoteFormat';

/**
 * Danh sách báo giá đã lưu: tải lần đầu (retry 2 lần), theo dõi Realtime và
 * nạp lại khi online / focus / tab hiện lại. Trả về cả bộ lọc theo từ khoá + trạng thái.
 */
export function useQuoteHistory(
  quoteSearch: string,
  quoteStatusFilter: QuoteRecord['status'] | '',
) {
  const [history, setHistory] = useState<QuoteRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const historyRequestIdRef = useRef(0);

  const refreshHistory = async (): Promise<boolean> => {
    const requestId = ++historyRequestIdRef.current;
    const quotes = await getAllQuotes();
    if (requestId !== historyRequestIdRef.current) return false;
    setHistory(quotes);
    return true;
  };

  useEffect(() => {
    let active = true;
    const retryTimers = new Set<number>();
    const reload = (attempt = 0) => {
      if (attempt === 0) setHistoryLoading(true);
      void refreshHistory()
        .then((applied) => {
          if (!active || !applied) return;
          setHistoryError('');
          setHistoryLoading(false);
        })
        .catch((error) => {
          if (!active) return;
          if (attempt < 2 && navigator.onLine) {
            const timer = window.setTimeout(() => {
              retryTimers.delete(timer);
              reload(attempt + 1);
            }, (attempt + 1) * 1_000);
            retryTimers.add(timer);
            return;
          }
          setHistoryLoading(false);
          setHistoryError(operationError('Không thể tải danh sách báo giá từ Supabase', error));
        });
    };
    const reloadWhenVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    reload();
    const reloadNow = () => reload(0);
    const unsubscribe = subscribeToQuotes(reloadNow, (status) => {
      // The first SUBSCRIBED closes the REST/socket race; later ones repair
      // anything missed while Realtime was reconnecting.
      if (status === 'SUBSCRIBED') reloadNow();
    });
    window.addEventListener('online', reloadNow);
    window.addEventListener('focus', reloadNow);
    document.addEventListener('visibilitychange', reloadWhenVisible);
    return () => {
      active = false;
      historyRequestIdRef.current += 1;
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      unsubscribe();
      window.removeEventListener('online', reloadNow);
      window.removeEventListener('focus', reloadNow);
      document.removeEventListener('visibilitychange', reloadWhenVisible);
    };
  }, []);

  const filteredHistory = useMemo(() => {
    const q = quoteSearch.trim().toLowerCase();
    return history.filter((quote) => {
      const statusOk = !quoteStatusFilter || quote.status === quoteStatusFilter;
      const text = [
        quote.code,
        quote.customerName,
        quote.customerPhone,
        quote.customerEmail,
        quote.customerAddress,
        quote.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return statusOk && (!q || text.includes(q));
    });
  }, [history, quoteSearch, quoteStatusFilter]);

  return {
    history,
    filteredHistory,
    historyLoading,
    historyError,
    refreshHistory,
    setHistoryLoading,
    setHistoryError,
  };
}
