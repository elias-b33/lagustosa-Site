import { createManagementHandler } from '../lib/restaurant-management.mjs';

// Vercel server only: keys and access checks never reach the browser bundle.
export default { fetch(request) { return createManagementHandler({env:process.env})(request); } };
