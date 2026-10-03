import { handleTokenRequest, providersFromEnv } from '../lib/token-proxy.ts';

/** Token exchange for cloud backups: see `netlify/lib/token-proxy.ts`. */
export default async (req: Request, context: { params: Record<string, string> }) =>
	handleTokenRequest(req, context.params.provider ?? '', providersFromEnv(process.env));

export const config = {
	path: '/api/oauth/:provider/token',
	// A device asks for a token about once an hour; this only stops a flood, by address.
	rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
