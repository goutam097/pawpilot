import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { startReminderNotifier, stopReminderNotifier } from './services/reminderNotifierService.js';
/**
 * Process entry point.
 *
 * Order matters:
 *   1. Connect to Mongo. If this fails, exit — there's no point serving
 *      requests we can't fulfill.
 *   2. Start HTTP listener.
 *   3. Install shutdown handlers that close HTTP first (drain in-flight),
 *      then Mongo.
 */
async function bootstrap() {
    await connectDb();
    const app = createApp();
    const server = app.listen(env.port, env.host, () => {
        const bindTarget = env.host === '0.0.0.0' ? '0.0.0.0' : env.host;
        console.log(JSON.stringify({
            level: 'info',
            type: 'server',
            msg: `listening on http://${bindTarget}:${env.port}`,
            env: env.nodeEnv,
            accessUrl: `http://192.168.1.14:${env.port}`,
        }));
    });
    // Start the reminder notifier. In tests, we won't call bootstrap, so the
    // notifier doesn't interfere with test runs.
    startReminderNotifier();
    let shuttingDown = false;
    const shutdown = (signal) => {
        if (shuttingDown)
            return; // guard against double SIGINT (Ctrl+C twice)
        shuttingDown = true;
        console.log(JSON.stringify({ level: 'info', type: 'server', msg: `received ${signal}` }));
        stopReminderNotifier();
        server.close(async (err) => {
            if (err) {
                console.error(JSON.stringify({ level: 'error', type: 'server', msg: 'http close error', error: err.message }));
                process.exit(1);
            }
            try {
                await disconnectDb();
            }
            catch (dbErr) {
                const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
                console.error(JSON.stringify({ level: 'error', type: 'server', msg: 'db close error', error: msg }));
                process.exit(1);
            }
            process.exit(0);
        });
        setTimeout(() => {
            console.error(JSON.stringify({ level: 'error', type: 'server', msg: 'forced shutdown after 10s' }));
            process.exit(1);
        }, 10_000).unref();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
bootstrap().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: 'error', type: 'bootstrap', msg: 'fatal startup error', error: msg }));
    process.exit(1);
});
//# sourceMappingURL=server.js.map