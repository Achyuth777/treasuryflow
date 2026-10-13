import { env } from 'cloudflare:workers';
// Shared JavaScript API is exercised directly by integration tests.
import { handleBusiness } from '../../../../server/business.mjs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleBusiness(request, env);
export const POST = GET;
export const PATCH = GET;
export const DELETE = GET;
