import { handle } from '../server/router.js';

// Single Vercel function for the whole assessment API (see server/router.ts).
export default {
  fetch(request: Request): Promise<Response> {
    return handle(request);
  },
};
