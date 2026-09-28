import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Request validation middleware factory.
 *
 * Usage:
 *   router.post('/register', validate({ body: registerSchema }), authController.register);
 */

type ValidatedPart = 'body' | 'query' | 'params';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      for (const part of Object.keys(schemas) as ValidatedPart[]) {
        const schema = schemas[part];
        if (!schema) continue;

        const parsed = schema.parse(req[part]);

        if (part === 'query') {
          Object.defineProperty(req, 'query', {
            value: parsed,
            writable: true,
            configurable: true,
          });
        } else {
          req[part] = parsed;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Convenience wrapper for the common case: validating only the request body.
 */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return validate({ body: schema });
}