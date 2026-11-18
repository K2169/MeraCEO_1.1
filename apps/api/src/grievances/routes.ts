import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { GrievanceRepository } from './repository.js';
import type { RequestRepository } from '../requests/repository.js';
import type { UserRecord } from '../users/repository.js';

const reportBody = z.object({
  category: z.enum(['technical', 'account', 'privacy', 'consultation', 'other']),
  message: z.string().trim().min(10).max(500),
  requestId: z.string().trim().min(1).max(100).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

// Public contact is explicit configuration; report contents are never returned through public APIs.
export function registerGrievanceRoutes(app: FastifyInstance, deps: {
  grievances?: GrievanceRepository;
  requests: RequestRepository;
  requireUser: (authorization: string | undefined, reply: FastifyReply) => Promise<UserRecord | null>;
  supportEmail?: string;
}) {
  app.get('/support', async () => ({ email: z.string().email().safeParse(deps.supportEmail).success ? deps.supportEmail : null }));
  app.post('/me/grievances', async (req, reply) => {
    const user = await deps.requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const body = reportBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_report' });
    if (body.data.requestId) {
      const request = await deps.requests.findById(body.data.requestId);
      if (!request || (request.ownerId !== user.id && request.professionalId !== user.id)) return reply.code(404).send({ error: 'request_not_found' });
    }
    if (!deps.grievances) return reply.code(503).send({ error: 'support_unavailable' });
    const report = await deps.grievances.create({ ...body.data, userId: user.id });
    return reply.code(201).send({ id: report.id, status: report.status });
  });
}
