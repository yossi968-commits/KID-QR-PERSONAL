/**
 * Just enough of Express's Router for the server's route modules to run in the
 * browser: ordered middleware and routes with :params, sync or async handlers.
 */
type Next = (err?: unknown) => void;
type Handler = (req: any, res: any, next: Next) => unknown;
type Layer = { method: string | null; re: RegExp | null; keys: string[]; handlers: Handler[] };

export const NO_MATCH = Symbol('no_match');

function compile(path: string) {
  const keys: string[] = [];
  const src = path.replace(/:(\w+)/g, (_m, k) => (keys.push(k), '([^/]+)'));
  return { re: new RegExp('^' + src + '/?$'), keys };
}

export function Router() {
  const stack: Layer[] = [];
  const route = (method: string) => (path: string, ...handlers: Handler[]) => { stack.push({ method, ...compile(path), handlers }); return r; };
  const r = {
    stack,
    use: (...handlers: Handler[]) => { stack.push({ method: null, re: null, keys: [], handlers }); return r; },
    get: route('GET'), post: route('POST'), put: route('PUT'), patch: route('PATCH'), delete: route('DELETE'),
    /** Run the request through this router. Rejects with NO_MATCH when no route matched. */
    handle(req: any, res: any) {
      return new Promise<void>((resolve, reject) => {
        res.onEnd = resolve;
        let i = 0;
        const runLayer = (layer: Layer, j: number, after: Next) => {
          const fn = layer.handlers[j];
          if (!fn) return after();
          try { fn(req, res, (err) => (err ? reject(err) : runLayer(layer, j + 1, after))); } catch (e) { reject(e); }
        };
        const next: Next = (err) => {
          if (err) return reject(err);
          while (i < stack.length) {
            const layer = stack[i++];
            if (layer.method === null) return runLayer(layer, 0, next);
            if (layer.method !== req.method) continue;
            const m = req.path.match(layer.re!);
            if (!m) continue;
            req.params = Object.fromEntries(layer.keys.map((k, n) => [k, decodeURIComponent(m[n + 1])]));
            return runLayer(layer, 0, next);
          }
          reject(NO_MATCH);
        };
        next();
      });
    },
  };
  return r;
}

export default { Router };
