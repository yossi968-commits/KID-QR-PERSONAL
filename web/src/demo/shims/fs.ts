// The demo database lives in memory; file operations are no-ops.
const noop = () => {};
export default { mkdirSync: noop, rmSync: noop, existsSync: () => false };
