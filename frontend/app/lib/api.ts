import { getAccessToken } from "./auth-token";

const DEFAULT_API_URL = "http://localhost:8000/api/v1";

export const API_URL = (
  import.meta.env.VITE_API_URL ?? DEFAULT_API_URL
).replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ValidationDetail {
  loc?: (string | number)[];
  msg?: string;
}

function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;

  const messages = detail
    .map((item: ValidationDetail) => {
      if (typeof item?.msg !== "string") return null;
      const field = item.loc?.filter((part) => part !== "body").at(-1);
      return field ? `${field}: ${item.msg}` : item.msg;
    })
    .filter((message): message is string => Boolean(message));

  return messages.length > 0 ? messages.join(". ") : null;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. Verifique que la API esté en ejecución.",
      0
    );
  }

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      message = formatDetail(body?.detail) ?? message;
    } catch {
      // El cuerpo no era JSON: se conserva el mensaje genérico.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
