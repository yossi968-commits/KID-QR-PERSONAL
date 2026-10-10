// Browser stand-in for the parts of node:crypto the server's sandbox adapters use.
class Bytes extends Uint8Array {
  toString(enc?: string) {
    if (enc === 'hex') return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('');
    const b64 = btoa(String.fromCharCode(...this));
    return enc === 'base64url' ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
  }
}
export const randomBytes = (n: number) => crypto.getRandomValues(new Bytes(n));
export default { randomBytes };
