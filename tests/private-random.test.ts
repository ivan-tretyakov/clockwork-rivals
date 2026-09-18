import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { random, stream } from "../packages/clockwork-rules/src/private-random";

it("private stream bytes match native HMAC across persisted counters, including 32-bit rollover", () => {
  const key = Array.from({ length: 8 }, (_, i) => 0x12345678 + i),
    state = stream(key);
  const bytes = Buffer.alloc(32);
  key.forEach((word, i) => bytes.writeUInt32BE(word, i * 4));
  for (const counter of [0, 1, 2, 0xffffffff, 0x100000000]) {
    const resumed = { ...structuredClone(state), counter },
      message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const expected =
      createHmac("sha256", bytes).update(message).digest().readUInt32BE(0) /
      4294967296;
    expect(random(resumed)).toBe(expected);
    expect(resumed.counter).toBe(counter + 1);
    expect(resumed.key).toEqual(key);
  }
});
