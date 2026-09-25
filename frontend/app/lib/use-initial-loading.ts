import { useEffect, useState } from "react";

export function useInitialLoading(ms = 450): boolean {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);

  return loading;
}