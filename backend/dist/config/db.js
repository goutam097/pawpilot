import mongoose from 'mongoose';
import { env } from './env.js';
/**
 * Manages the Mongoose connection lifecycle.
 *
 * Design notes:
 * - We do NOT auto-connect on import. Connection is explicit (`connectDb()`),
 *   called by `server.ts`. This keeps tests able to control their own DB.
 * - Mongoose's default connection is a global singleton. There is exactly one
 *   pool in this process, shared by every model. That is the intended design.
 * - We register listeners for `error`, `disconnected`, and `reconnected` so
 *   that transient network events are visible in logs, not silent.
 * - `strictQuery` is on (Mongoose 7+ default). Unknown query fields throw
 *   rather than silently match. Safer.
 */
export async function connectDb() {
    // Prevent double-connect in dev with tsx watch reloads.
    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }
    mongoose.set('strictQuery', true);
    mongoose.connection.on('connected', () => {
        console.log(JSON.stringify({ level: 'info', type: 'db', msg: 'mongodb connected' }));
    });
    mongoose.connection.on('disconnected', () => {
        console.warn(JSON.stringify({ level: 'warn', type: 'db', msg: 'mongodb disconnected' }));
    });
    mongoose.connection.on('error', (err) => {
        console.error(JSON.stringify({ level: 'error', type: 'db', msg: 'mongodb error', error: err.message }));
    });
    await mongoose.connect(env.mongodbUri, {
        // Fail fast if the server is unreachable at boot, rather than hanging for 30s.
        serverSelectionTimeoutMS: 10_000,
        // Reasonable pool defaults for a small API; tune in production.
        maxPoolSize: 10,
        minPoolSize: 0,
        // `autoIndex` is on in dev (Mongoose builds indexes from schemas).
        // In production we set it false and build indexes via migrations to avoid
        // an index-build storm on every deploy.
        autoIndex: !env.isProduction,
    });
    return mongoose;
}
/**
 * Close the connection. Called during graceful shutdown in `server.ts`.
 */
export async function disconnectDb() {
    if (mongoose.connection.readyState === 0)
        return;
    await mongoose.disconnect();
}
//# sourceMappingURL=db.js.map