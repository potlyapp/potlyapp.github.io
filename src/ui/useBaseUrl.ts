import { baseUrlWarnings, type BaseUrlWarning } from '../domain/qr';
import { useSettings } from './useSettings';

export interface BaseUrlInfo {
  baseUrl: string;
  warnings: BaseUrlWarning[];
}

/** Effective QR origin (configured, else the running origin) plus label-safety warnings. */
export function useBaseUrl(): BaseUrlInfo | undefined {
  const settings = useSettings();
  if (!settings) return undefined;
  const origin = window.location.origin;
  const baseUrl = settings.baseUrl ?? origin;
  return { baseUrl, warnings: baseUrlWarnings(baseUrl, origin) };
}
