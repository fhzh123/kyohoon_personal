import { createHandler } from '../server/app.mjs';
// Deployment has no path that opts into the local preview capability.
export default createHandler({ localPreview: false });
