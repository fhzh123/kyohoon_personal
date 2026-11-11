import http from 'node:http';
import { createHandler } from './app.mjs';
// This entry point is permanently production-only. No flag enables preview.
process.env.NODE_ENV='production';
const port=Number(process.env.PORT||3000);
const handler=createHandler({localPreview:false});
const server=http.createServer(handler);
server.listen(port,'127.0.0.1',()=>console.log(`Kyohoon homepage: http://127.0.0.1:${port} (production; local preview disabled)`));
