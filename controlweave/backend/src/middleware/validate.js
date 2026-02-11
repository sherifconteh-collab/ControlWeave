const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateBody(validator) {
  return (req, res, next) => {
    try {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({ success: false, error: 'Invalid request body' });
      }

      const errors = validator(req.body, req) || [];
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors
        });
      }

      return next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: [error.message]
      });
    }
  };
}

function requireFields(body, fields) {
  const errors = [];
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push(`${field} is required`);
    }
  }
  return errors;
}

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Strips null bytes, <script> blocks, and HTML tags from a string.
 * Non-string values are returned unchanged.
 */
function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\0/g, '')                          // null bytes
    .replace(/<script[\s\S]*?<\/script>/gi, '')  // full script elements
    .replace(/<[^>]+>/g, '');                    // remaining HTML tags
}

module.exports = {
  validateBody,
  requireFields,
  isUuid,
  isNonEmptyString,
  sanitizeInput
};