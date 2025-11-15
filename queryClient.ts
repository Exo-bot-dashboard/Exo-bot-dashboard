import { QueryClient } from "@tanstack/react-query";

async function handleResponse(response: Response) {
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    const message = (await response.json().catch(() => null))?.message;
    throw new Error(message || `${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const response = await fetch(queryKey[0] as string, {
          credentials: "include",
        });
        return handleResponse(response);
      },
      staleTime: 1000 * 60,
      retry: false,
    },
  },
});

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiRequest(
  url: string,
  method: Method = "GET",
  body?: any
) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  return handleResponse(response);
}
