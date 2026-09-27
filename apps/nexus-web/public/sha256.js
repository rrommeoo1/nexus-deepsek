// Nexus client — SHA-256 that exists outside a secure context.
//
// `crypto.subtle` is available on https and on localhost and nowhere else, so a phone that opens the app
// over the local network (`http://192.168.x.x:5000`) has no native hasher at all. Every upload hashes its
// bytes before the first request, so on that origin a photograph could not leave the phone: the save died
// before the network with a generic message. This module gives the same digest on every origin.
//
// The native path is used whenever it exists — it is faster — and this implementation is the fallback: a
// streaming SHA-256 over blocks, so a 20 MB video is hashed without holding a second copy in memory.

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

const HEX = "0123456789abcdef";

export function hexOf(bytes) {
  let out = "";
  for (const byte of bytes) out += HEX[byte >> 4] + HEX[byte & 15];
  return out;
}

// The same digest the platform would produce, byte for byte: blocks of 64 bytes, the 0x80 terminator, and
// the length in bits as a 64-bit big-endian number (which is why the byte count is kept in two halves).
export class Sha256 {
  constructor() {
    this.state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    this.block = new Uint8Array(64);
    this.blockView = new DataView(this.block.buffer);
    this.filled = 0;
    this.total = 0;
    this.words = new Uint32Array(64);
  }

  update(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let offset = 0;
    this.total += bytes.length;
    if (this.filled) {
      while (offset < bytes.length && this.filled < 64) this.block[this.filled++] = bytes[offset++];
      if (this.filled === 64) { this.#compress(); this.filled = 0; }
    }
    while (offset + 64 <= bytes.length) {
      this.block.set(bytes.subarray(offset, offset + 64));
      this.#compress();
      offset += 64;
    }
    while (offset < bytes.length) this.block[this.filled++] = bytes[offset++];
    return this;
  }

  #compress() {
    const words = this.words;
    const view = this.blockView;
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(index * 4);
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

  digestBytes() {
    const bitHigh = Math.floor(this.total / 536870912); // total * 8 / 2^32
    const bitLow = (this.total << 3) >>> 0;
    const tail = new Uint8Array(this.filled < 56 ? 64 : 128);
    tail.set(this.block.subarray(0, this.filled));
    tail[this.filled] = 0x80;
    const view = new DataView(tail.buffer);
    view.setUint32(tail.length - 8, bitHigh);
    view.setUint32(tail.length - 4, bitLow);
    const clone = new Sha256();
    clone.state.set(this.state);
    clone.filled = 0;
    clone.update(tail);
    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let index = 0; index < 8; index++) outView.setUint32(index * 4, clone.state[index]);
    return out;
  }

  digestHex() {
    return hexOf(this.digestBytes());
  }
}

export function sha256Hex(bytes) {
  return new Sha256().update(bytes).digestHex();
}

export const SHA256_BLOCK_BYTES = 1024 * 1024;

// The digest of what the owner chose: the platform's own hasher when this origin has one, and this
// implementation when it does not. The fallback reads a file a megabyte at a time, so a large video is
// hashed while it is read instead of after the whole copy sits in memory.
export async function digestHexOf(value, { subtle = globalThis.crypto?.subtle, blockBytes = SHA256_BLOCK_BYTES } = {}) {
  if (typeof value === "string") value = new TextEncoder().encode(value);
  const isBlob = typeof value?.arrayBuffer === "function" && typeof value?.slice === "function" && Number.isFinite(Number(value?.size));
  if (subtle && typeof subtle.digest === "function") {
    const bytes = isBlob ? await value.arrayBuffer() : value;
    return hexOf(new Uint8Array(await subtle.digest("SHA-256", bytes)));
  }
  if (isBlob) {
    const hasher = new Sha256();
    for (let offset = 0; offset < value.size; offset += blockBytes) {
      hasher.update(new Uint8Array(await value.slice(offset, offset + blockBytes).arrayBuffer()));
    }
    return hasher.digestHex();
  }
  return new Sha256().update(value).digestHex();
}

