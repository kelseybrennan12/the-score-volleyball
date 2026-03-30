const defaultApiBaseUrl = "/api";
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl;

const normalizePath = (path: string): string => {
  return path.startsWith("/") ? path : `/${path}`;
};

export const resolveApiUrl = (path: string): string => {
  const normalizedPath = normalizePath(path);
  return `${apiBaseUrl}${normalizedPath}`;
};
