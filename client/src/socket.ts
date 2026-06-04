import { io } from 'socket.io-client';

// Connect to the Node.js server running on port 3001
export const socket = io('http://localhost:3001');