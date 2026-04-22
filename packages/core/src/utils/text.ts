export function hasUtf8Bom(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

export function stripUtf8Bom(buffer: Buffer): Buffer {
  return hasUtf8Bom(buffer) ? buffer.subarray(3) : buffer;
}

export function bufferToUtf8(buffer: Buffer): string {
  return stripUtf8Bom(buffer).toString('utf8');
}
