/**
 * Validates whether an incoming HTTP/WebSocket Origin header is permitted.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  allowMissingOrigin: boolean = false
): boolean {
  if (!origin) {
    return allowMissingOrigin;
  }

  if (allowedOrigins.some((allowed) => allowed.trim() === "*")) {
    return true;
  }

  const normalizedOrigin = origin.trim().replace(/\/+$/, "").toLowerCase();

  return allowedOrigins.some((allowed) => {
    const normalizedAllowed = allowed.trim().replace(/\/+$/, "").toLowerCase();
    return normalizedOrigin === normalizedAllowed;
  });
}
