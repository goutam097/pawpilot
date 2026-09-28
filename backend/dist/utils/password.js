import bcrypt from 'bcrypt';
/**
 * bcrypt cost factor.
 *
 * Each +1 doubles the hashing time. 12 is the modern default:
 * - ~250ms on typical server hardware.
 * - Round 10 (~60ms) is too weak now; round 14+ stresses signup latency.
 *
 * If your server is unusually slow/fast, benchmark and adjust. Never go
 * below 10.
 */
const BCRYPT_ROUNDS = 12;
export async function hashPassword(plain) {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
export async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}
//# sourceMappingURL=password.js.map