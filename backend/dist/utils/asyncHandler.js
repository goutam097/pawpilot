/**
 * Wraps an async Express handler so that rejected promises reach the
 * centralized error handler.
 *
 * The problem:
 *   app.get('/x', async (req, res) => {
 *     const data = await db.find(); // throws!
 *     res.json(data);
 *   });
 *
 * If `db.find()` rejects, Express 4 does NOT forward it to the error middleware —
 * the promise rejects into the void and the request hangs until the client times
 * out. (Express 5 fixed this; we're on 4.x for ecosystem stability.)
 *
 * The workaround used everywhere in the wild:
 *   wrap every async handler in a function that catches and calls next(err).
 *
 * Why a helper instead of try/catch in every controller?
 * - try/catch adds 3 lines × N controllers and clutters intent.
 * - Controllers should read as "what I do on success" and let errors bubble
 *   to a single, testable place.
 * - Forgetting try/catch in a new handler becomes a silent hang, not a crash.
 *   A helper removes that entire failure mode.
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=asyncHandler.js.map