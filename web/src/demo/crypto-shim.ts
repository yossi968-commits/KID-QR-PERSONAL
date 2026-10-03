// Browser stand-in for node:crypto, used only by the in-browser demo build.
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
export default { randomBytes: (n: number) => ({ toString: () => hex(n) }) };
