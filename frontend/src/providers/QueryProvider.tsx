"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

interface QueryProviderProps {
  children: ReactNode;
}

export default function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Deduplicate requests within 2 seconds
            staleTime: 2000,
            // Keep data in cache for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Don't refetch on window focus in development
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
