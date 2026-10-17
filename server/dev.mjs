import { createServer } from 'node:http';
import handler from '../api/index.js';

createServer(handler).listen(3001, '127.0.0.1', () => console.log('API local: http://127.0.0.1:3001/api'));
