export function validate(schemas) {
    return (req, _res, next) => {
        try {
            for (const part of Object.keys(schemas)) {
                const schema = schemas[part];
                if (!schema)
                    continue;
                const parsed = schema.parse(req[part]);
                if (part === 'query') {
                    Object.defineProperty(req, 'query', {
                        value: parsed,
                        writable: true,
                        configurable: true,
                    });
                }
                else {
                    req[part] = parsed;
                }
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
/**
 * Convenience wrapper for the common case: validating only the request body.
 */
export function validateBody(schema) {
    return validate({ body: schema });
}
//# sourceMappingURL=validate.js.map