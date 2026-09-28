import { MAX_PAYLOAD_BYTES } from "../config/constants.js";

export function isPayloadWithinLimit(
  raw: string | Buffer | ArrayBuffer | Buffer[],
  limitBytes: number = MAX_PAYLOAD_BYTES
): boolean {
  if (typeof raw === "string") {
    return Buffer.byteLength(raw, "utf8") <= limitBytes;
  }
  if (Buffer.isBuffer(raw)) {
    return raw.byteLength <= limitBytes;
  }
  if (Array.isArray(raw)) {
    const total = raw.reduce((sum, b) => sum + b.byteLength, 0);
    return total <= limitBytes;
  }
  if (raw instanceof ArrayBuffer) {
    return raw.byteLength <= limitBytes;
  }
  return false;
}
