'use strict';

const Fastify = require('fastify');
const { fakePgQuery, verifyToken, findingSchema } = require('../lib/fixtures');

async function authenticate(request, reply) {
  const header = request.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'missing bearer token' });
  }
  try {
    request.user = verifyToken(header.slice(7));
  } catch (_err) {
    return reply.code(401).send({ error: 'invalid token' });
  }
}

function build() {
  const fastify = Fastify({ logger: false });

  fastify.get('/api/v1/ping', async () => ({ ok: true }));

  fastify.get(
    '/api/v1/controls',
    { preHandler: authenticate },
    async (request) => {
      const result = await fakePgQuery(
        'SELECT * FROM framework_controls WHERE organization_id = $1 LIMIT 25',
        [request.user.organization_id]
      );
      return { success: true, data: result.rows };
    }
  );

  fastify.post(
    '/api/v1/findings',
    {
      preHandler: authenticate,
      schema: { body: findingSchema },
    },
    async (request, reply) => {
      const result = await fakePgQuery(
        'INSERT INTO findings (organization_id, title, severity, description) VALUES ($1, $2, $3, $4) RETURNING id',
        [request.user.organization_id, request.body.title, request.body.severity, request.body.description || null]
      );
      reply.code(201);
      return { success: true, data: result.rows[0] };
    }
  );

  fastify.setErrorHandler((err, _request, reply) => {
    const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.code(code).send({ error: err.message || 'internal error' });
  });

  return fastify;
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || '3012', 10);
  build()
    .listen({ port, host: '127.0.0.1' })
    .then((addr) => {
      // eslint-disable-next-line no-console
      console.log(`[fastify-spike] listening on ${addr}`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}

module.exports = { build };
