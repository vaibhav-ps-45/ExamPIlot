/** IANA zones the browser knows about, always including `current` even if it is not listed. */
export const timeZoneOptions = (current: string): string[] => {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return supported.includes(current) ? supported : [current, ...supported];
};
