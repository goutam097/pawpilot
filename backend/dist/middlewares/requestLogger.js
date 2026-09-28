/**
 * One structured log line per request, emitted when the response is finished.
 *
 * Design choices:
 * - We log on `res.on('finish')`, not on request receipt. That way we know
 *   the status code and total duration.
 * - We emit JSON — easy for aggregators to parse, easy to grep locally.
 * - We deliberately do not log request bodies. They may contain passwords,
 *   tokens, or PII. If we ever need body logging, it's an explicit opt-in
 *   with redaction rules, per route.
 * - Skip logging for /health to avoid drowning logs in health-check noise
 *   from load balancers (they can hit every 5s).
 */
export function requestLogger(req, res, next) {
    if (req.path === '/health') {
        return next();
    }
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const line = JSON.stringify({
            level: 'info',
            type: 'http',
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            // `ip` from Express respects `trust proxy` if configured. We don't yet,
            // which is fine for local dev; adjust in Phase 29 (production config).
            ip: req.ip,
            userAgent: req.get('user-agent') ?? undefined,
        });
        console.log(line);
    });
    next();
}
//# sourceMappingURL=requestLogger.js.map