import { AxiosError } from 'axios';

const BOT_TOKEN_IN_URL = /\/bot[^/]+\//;
const CARD_KEY = /card/i;
const DIGITS_ONLY_PAN = /^\d{13,19}$/;

export function formatErrorDetails(error: unknown): string {
  if (error instanceof AxiosError) {
    const parts = [error.message];
    if (error.code) {
      parts.push(`code=${error.code}`);
    }
    if (error.response) {
      parts.push(`status=${error.response.status}`);
    }

    const url = error.config?.url ?? error.config?.baseURL;
    if (url) {
      parts.push(`url=${sanitizeUrl(url)}`);
    }

    if (error.response?.data !== undefined) {
      parts.push(`response=${safeJson(sanitizeForLog(error.response.data))}`);
    }

    return parts.join('; ');
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function sanitizeUrl(url: string): string {
  return url.replace(BOT_TOKEN_IN_URL, '/bot***/');
}

function sanitizeForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (CARD_KEY.test(key)) {
        result[key] = '[redacted]';
        continue;
      }
      result[key] = sanitizeForLog(nested);
    }
    return result;
  }

  if (typeof value === 'string' && DIGITS_ONLY_PAN.test(value.replace(/\s+/g, ''))) {
    return '[redacted]';
  }

  return value;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
