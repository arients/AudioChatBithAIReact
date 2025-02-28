import { io } from 'socket.io-client';
// Connect to the same origin so that both client and server run on one port.
const socket = io();
export default socket;
