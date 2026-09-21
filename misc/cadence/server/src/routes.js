/**
 * Async-safe route registration.
 *
 * Express 4 does not forward a rejected promise from an async handler to the
 * error middleware. A handler that throws — a Prisma error, a bad JSON body, a
 * failed upstream call — leaves the request with no reply at all, and the
 * browser sits there until it times out. That failure is invisible in the
 * server log and looks like a hung network to the person using it.
 *
 * Registering through these wrappers turns any rejection into `next(err)`, so
 * it reaches the error middleware and comes back as a real response.
 */
export const asyncRoutes = (app) => {
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  return {
    get: (path, fn) => app.get(path, wrap(fn)),
    post: (path, fn) => app.post(path, wrap(fn)),
    patch: (path, fn) => app.patch(path, wrap(fn)),
    delete: (path, fn) => app.delete(path, wrap(fn)),
  };
};
