export interface ApiJson {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const getApiBaseUrl = (): string => {
  const configured = (import.meta as any)?.env?.VITE_API_BASE_URL;
  if (typeof configured === 'string' && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  if (window.location.protocol === 'file:') {
    return 'http://localhost:3000';
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  return '';
};

export const apiUrl = (path: string): string => {
  const base = getApiBaseUrl();
  if (path.startsWith('/')) {
    return `${base}${path}`;
  }
  return `${base}/${path}`;
};

const snippet = (value: string, max = 160): string => {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}...` : value;
};

export const parseApiResponse = async (response: Response): Promise<ApiJson> => {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  let parsed: ApiJson | null = null;

  if (contentType.includes('application/json')) {
    try {
      parsed = JSON.parse(text) as ApiJson;
    } catch {
      throw new Error(`Invalid JSON response from API. ${snippet(text)}`);
    }
  } else {
    try {
      parsed = JSON.parse(text) as ApiJson;
    } catch {
      throw new Error(
        `API returned non-JSON response (${response.status}). ${snippet(text) || 'Please ensure backend server is running.'}`
      );
    }
  }

  if (!response.ok || parsed?.success === false) {
    throw new Error(parsed?.error || parsed?.message || `Request failed with status ${response.status}`);
  }

  return parsed;
};

export const fetchApiJson = async (input: RequestInfo | URL, init?: RequestInit): Promise<ApiJson> => {
  const response = await fetch(input, init);
  return parseApiResponse(response);
};
