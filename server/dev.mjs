import http from 'node:http';
import { createHandler } from './app.mjs';
if(process.env.NODE_ENV==='production'||process.env.VERCEL) throw Error('Local preview is unavailable in production.');
process.env.NODE_ENV='development';
const portIndex=process.argv.indexOf('--port');
const port=Number(process.env.PORT||(portIndex >= 0 ? process.argv[portIndex+1] : 3000));
const server=http.createServer(createHandler({localPreview:true}));
server.listen(port,'127.0.0.1',()=>console.log(`Kyohoon homepage: http://127.0.0.1:${port} (local development)`));
