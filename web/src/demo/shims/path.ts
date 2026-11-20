const join = (...p: string[]) => p.join('/').replace(/\/+/g, '/');
export default { join, resolve: join, dirname: (p: string) => p.replace(/\/[^/]*$/, '') || '/' };
