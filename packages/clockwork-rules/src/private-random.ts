import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

/** Authoritative only: independent 256-bit keys and counters are never projected. */
export interface PrivateStream {
  key: number[];
  counter: number;
}
export function stream(key: number[]): PrivateStream {
  return { key: [...key], counter: 0 };
}
export function random(s: PrivateStream): number {
  if (
    !Number.isSafeInteger(s.counter) ||
    s.counter < 0 ||
    s.counter === Number.MAX_SAFE_INTEGER
  )
    throw new Error("Invalid private random counter.");
  const key = new Uint8Array(32),
    keyView = new DataView(key.buffer);
  for (let i = 0; i < 8; i++) keyView.setUint32(i * 4, s.key[i], false);
  const message = new Uint8Array(8),
    view = new DataView(message.buffer);
  view.setUint32(0, Math.floor(s.counter / 4294967296), false);
  view.setUint32(4, s.counter >>> 0, false);
  const output = hmac(sha256, key, message);
  s.counter++;
  return (
    new DataView(output.buffer, output.byteOffset, output.byteLength).getUint32(
      0,
      false,
    ) / 4294967296
  );
}
