/**
 * SHA-256 without any platform hasher.
 *
 * The web client carries its own hasher because `crypto.subtle` only exists in a secure context;
 * the Android client needs one because React Native ships no `SubtleCrypto` at all. Every resumable
 * upload sends `expected_sha256` before the first byte is transferred, so the digest has to be
 * produced on the device. This implementation streams, so a 20 MB video is hashed while it is read
 * instead of after a second copy sits in memory.
 *
 * It is a byte-for-byte port of `apps/nexus-web/public/sha256.js`: the same client-side digest both
 * products send to `POST /api/uploads`.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const HEX = '0123456789abcdef';

/** Block size used while hashing a file, so a large video is never held in memory twice. */
export const SHA256_BLOCK_BYTES = 1024 * 1024;

export function hexOf(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += HEX[byte >> 4] + HEX[byte & 15];
  return out;
}

export class Sha256 {
  private state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private block = new Uint8Array(64);
  private filled = 0;
  private total = 0;
  private words = new Uint32Array(64);

  update(input: Uint8Array | ArrayBuffer): this {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let offset = 0;
    this.total += bytes.length;
    if (this.filled) {
      while (offset < bytes.length && this.filled < 64) this.block[this.filled++] = bytes[offset++];
      if (this.filled === 64) { this.compress(); this.filled = 0; }
    }
    while (offset + 64 <= bytes.length) {
      this.block.set(bytes.subarray(offset, offset + 64));
      this.compress();
      offset += 64;
    }
    while (offset < bytes.length) this.block[this.filled++] = bytes[offset++];
    return this;
  }

  digestBytes(): Uint8Array {
    // The length is written as a 64-bit big-endian bit count, so the byte count is kept in halves.
    const bitHigh = Math.floor(this.total / 536870912);
    const bitLow = (this.total << 3) >>> 0;
    const tail = new Uint8Array(this.filled < 56 ? 64 : 128);
    tail.set(this.block.subarray(0, this.filled));
    tail[this.filled] = 0x80;
    tail[tail.length - 8] = (bitHigh >>> 24) & 0xff;
    tail[tail.length - 7] = (bitHigh >>> 16) & 0xff;
    tail[tail.length - 6] = (bitHigh >>> 8) & 0xff;
    tail[tail.length - 5] = bitHigh & 0xff;
    tail[tail.length - 4] = (bitLow >>> 24) & 0xff;
    tail[tail.length - 3] = (bitLow >>> 16) & 0xff;
    tail[tail.length - 2] = (bitLow >>> 8) & 0xff;
    tail[tail.length - 1] = bitLow & 0xff;
    // The padding is absorbed by a copy, so the state of this hasher stays usable.
    const clone = new Sha256();
    clone.state.set(this.state);
    clone.filled = 0;
    clone.update(tail);
    const out = new Uint8Array(32);
    for (let index = 0; index < 8; index++) {
      const word = clone.state[index];
      out[index * 4] = (word >>> 24) & 0xff;
      out[index * 4 + 1] = (word >>> 16) & 0xff;
      out[index * 4 + 2] = (word >>> 8) & 0xff;
      out[index * 4 + 3] = word & 0xff;
    }
    return out;
  }

  digestHex(): string {
    return hexOf(this.digestBytes());
  }

  private compress(): void {
    const words = this.words;
    const block = this.block;
    for (let index = 0; index < 16; index++) {
      const at = index * 4;
      words[index] = ((block[at] << 24) | (block[at + 1] << 16) | (block[at + 2] << 8) | block[at + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index++) {
      const w15 = words[index - 15];
      const w2 = words[index - 2];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = this.state;
    for (let index = 0; index < 64; index++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[index] + words[index]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    this.state[0] = (this.state[0] + a) >>> 0;
    this.state[1] = (this.state[1] + b) >>> 0;
    this.state[2] = (this.state[2] + c) >>> 0;
    this.state[3] = (this.state[3] + d) >>> 0;
    this.state[4] = (this.state[4] + e) >>> 0;
    this.state[5] = (this.state[5] + f) >>> 0;
    this.state[6] = (this.state[6] + g) >>> 0;
    this.state[7] = (this.state[7] + h) >>> 0;
  }
}

export function sha256Hex(bytes: Uint8Array | ArrayBuffer): string {
  return new Sha256().update(bytes).digestHex();
}
