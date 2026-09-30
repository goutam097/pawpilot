import 'dotenv/config';

type NodeEnv = 'development' | 'production' | 'test';

interface Env {
  readonly nodeEnv: NodeEnv;
  readonly host: string;
  readonly port: number;
  readonly isProduction: boolean;
  readonly corsOrigins: readonly string[];

  readonly mongodbUri: string;

  readonly jwtAccessSecret: string;
  readonly jwtRefreshSecret: string;
  readonly jwtAccessExpiresIn: string;
  readonly jwtRefreshExpiresIn: string;

  readonly cloudinaryCloudName: string;
  readonly cloudinaryApiKey: string;
  readonly cloudinaryApiSecret: string;
  readonly cloudinaryFolder: string;
  readonly publicAppUrl: string;
  readonly appleTeamId: string | null;
}

function readNodeEnv(): NodeEnv {
  const raw = process.env.NODE_ENV ?? 'development';
  if (raw !== 'development' && raw !== 'production' && raw !== 'test') {
    throw new Error(`Invalid NODE_ENV: "${raw}". Expected development | production | test.`);
  }
  return raw;
}

function readHost(): string {
  const raw = process.env.HOST ?? '0.0.0.0';
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('HOST cannot be empty. Use 0.0.0.0 for LAN access or localhost for local-only mode.');
  }
  return trimmed;
}

function readPort(): number {
  const raw = process.env.PORT ?? '3000';
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT: "${raw}". Expected an integer between 1 and 65535.`);
  }
  return parsed;
}

function readCorsOrigins(nodeEnv: NodeEnv): readonly string[] {
  const raw = process.env.CORS_ORIGINS?.trim() ?? '';
  if (raw === '') {
    return nodeEnv === 'production'
      ? []
      : ['http://localhost:8081', 'http://localhost:19006'];
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function readRequiredString(name: string, minLength = 1): string {
  const raw = process.env[name];
  if (typeof raw !== 'string' || raw.trim().length < minLength) {
    throw new Error(
      `Missing or too-short env var ${name}. Expected at least ${minLength} characters.`,
    );
  }
  return raw.trim();
}

function readMongoUri(): string {
  const uri = readRequiredString('MONGODB_URI');
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  return uri;
}

function readJwtSecret(name: string): string {
  const secret = readRequiredString(name, 32);
  if (secret.startsWith('replace-me')) {
    throw new Error(`${name} is still the placeholder value. Generate a real secret.`);
  }
  return secret;
}

function readCloudinaryConfig() {
  return {
    cloudName: readRequiredString('CLOUDINARY_CLOUD_NAME', 3),
    apiKey: readRequiredString('CLOUDINARY_API_KEY', 3),
    apiSecret: readRequiredString('CLOUDINARY_API_SECRET', 3),
    folder: process.env.CLOUDINARY_FOLDER?.trim() || 'pawpilot',
  };
}

const nodeEnv = readNodeEnv();

const jwtAccessSecret = readJwtSecret('JWT_ACCESS_SECRET');
const jwtRefreshSecret = readJwtSecret('JWT_REFRESH_SECRET');

if (jwtAccessSecret === jwtRefreshSecret) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
}

const cloudinaryConfig = readCloudinaryConfig();

export const env: Env = Object.freeze({
  nodeEnv,
  host: readHost(),
  port: readPort(),
  isProduction: nodeEnv === 'production',
  corsOrigins: Object.freeze(readCorsOrigins(nodeEnv)),

  mongodbUri: readMongoUri(),

  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

  cloudinaryCloudName: cloudinaryConfig.cloudName,
  cloudinaryApiKey: cloudinaryConfig.apiKey,
  cloudinaryApiSecret: cloudinaryConfig.apiSecret,
  cloudinaryFolder: cloudinaryConfig.folder,
  publicAppUrl: process.env.PUBLIC_APP_URL?.trim() || 'https://pawpilot.app',
  appleTeamId: process.env.APPLE_TEAM_ID?.trim() || null,
});