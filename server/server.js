import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import mediasoup from 'mediasoup';
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

const fetchPublicIP = async () => {
    try {
        const response = await axios.get('https://api64.ipify.org?format=json');
        process.env.ANNOUNCED_IP = response.data.ip;
        console.log('Detected ANNOUNCED_IP:', process.env.ANNOUNCED_IP);
    } catch (error) {
        console.error('Error fetching public IP:', error);
    }
};

fetchPublicIP();

// Import our in‐memory database functions
import {
    CreateRoom,
    AddUserToRoom,
    CreateNewUser,
    DeleteUser,
    GetRoomById,
    UpdateUserName,
    TerminateRoom,
    UpdateUserMicStatus,
    UpdateUserTalkingStatus
} from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Serve static files (client build)
app.use(express.static(path.join(__dirname, 'public')));

// Support client-side routing by returning index.html for all unmatched routes.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const io = new Server(server, { cors: { origin: "*" } });

// ----------------- Mediasoup Setup -----------------
let worker = null;
let router = null;
const transports = new Map();
const producers = new Map();
const consumers = new Map();

const initializeMediasoup = async () => {
    try {
        worker = await mediasoup.createWorker({ logLevel: 'warn' });
        worker.on('died', () => {
            console.error('Mediasoup worker died, restarting...');
            setTimeout(initializeMediasoup, 2000);
        });
        router = await worker.createRouter({
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2
                }
            ]
        });
        console.log('Mediasoup worker and router initialised');
    } catch (error) {
        console.error('Error initialising Mediasoup:', error);
        process.exit(1);
    }
};

initializeMediasoup();

const sendExistingProducers = (socket, roomId) => {
    producers.forEach((producer, id) => {
        if (producer.appData.roomId === roomId && producer.appData.socketId !== socket.id) {
            socket.emit('existingProducer', { producerId: id, userId: producer.appData.socketId });
        }
    });
};

// ----------------- Socket.IO Handlers -----------------
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    // Create a new user
    CreateNewUser(socket.id, "");

    // Send user ID to client
    socket.on('getUserId', (callback) => {
        if (typeof callback === 'function') {
            callback(socket.id);
        }
    });

    // Update username on the server
    socket.on('updateName', ({ userName }, callback) => {
        UpdateUserName(socket.id, userName);
        callback({ success: true });
    });

    // Update microphone status
    socket.on('updateMicStatus', ({ micStatus }, callback) => {
        UpdateUserMicStatus(socket.id, micStatus);
        const roomId = socket.roomId;
        if (roomId) {
            updateParticipants(roomId);
        }
        callback({ success: true });
    });

    // Update talking status
    socket.on('updateTalkingStatus', ({ isTalking }, callback) => {
        UpdateUserTalkingStatus(socket.id, isTalking);
        const roomId = socket.roomId;
        if (roomId) {
            updateParticipants(roomId);
        }
        callback({ success: true });
    });

    // Create room
    socket.on('createRoom', () => {
        const room = CreateRoom();
        socket.emit('roomCreated', { roomId: room.roomId });
    });

    // Join room
    socket.on('joinRoom', ({ roomId, userName }, callback) => {
        if (!roomId || !socket.id) {
            console.error('Invalid joinRoom data:', { roomId, socketId: socket.id });
            callback({ error: 'Invalid room or user ID' });
            return;
        }
        AddUserToRoom(roomId, socket.id, userName);
        socket.join(roomId);
        socket.roomId = roomId;
        updateParticipants(roomId);
        sendExistingProducers(socket, roomId);
        callback({ success: true });
    });

    // Terminate room (admin only)
    socket.on('terminateRoom', ({ roomId }, callback) => {
        const room = GetRoomById(roomId);
        if (room) {
            if (room.adminUserId === socket.id) {
                TerminateRoom(roomId);
                io.to(roomId).emit('roomTerminated');
                callback({ success: true });
            } else {
                callback({ error: 'Only admin can terminate the room' });
            }
        } else {
            callback({ error: 'Room not found' });
        }
    });

    // ---- Mediasoup events ----
    socket.on('getRouterRtpCapabilities', (callback) => {
        if (typeof callback !== 'function') return;
        if (!router) {
            console.error('Router not initialised');
            callback(null);
            return;
        }
        callback(router.rtpCapabilities);
    });

    socket.on('createProducerTransport', async ({ roomId }, callback) => {
        if (typeof callback !== 'function') return;
        try {
            if (!router) throw new Error('Router not initialised');
            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1' }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                appData: { socketId: socket.id, type: 'producer', roomId }
            });
            transports.set(transport.id, transport);
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        } catch (error) {
            console.error('Error creating producer transport:', error);
            callback(null);
        }
    });

    socket.on('createConsumerTransport', async ({ roomId }, callback) => {
        if (typeof callback !== 'function') return;
        try {
            if (!router) throw new Error('Router not initialised');
            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1' }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                appData: { socketId: socket.id, type: 'consumer', roomId }
            });
            transports.set(transport.id, transport);
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        } catch (error) {
            console.error('Error creating consumer transport:', error);
            callback(null);
        }
    });

    socket.on('connectProducerTransport', async ({ dtlsParameters, transportId }, callback) => {
        if (typeof callback !== 'function') return;
        try {
            const transport = transports.get(transportId);
            if (!transport) throw new Error('Producer transport not found');
            await transport.connect({ dtlsParameters });
            callback({ success: true });
        } catch (error) {
            console.error('Error connecting producer transport:', error);
            callback({ error: error.message });
        }
    });

    socket.on('connectConsumerTransport', async ({ dtlsParameters, transportId }, callback) => {
        if (typeof callback !== 'function') return;
        try {
            const transport = transports.get(transportId);
            if (!transport) throw new Error('Consumer transport not found');
            await transport.connect({ dtlsParameters });
            callback({ success: true });
        } catch (error) {
            console.error('Error connecting consumer transport:', error);
            callback({ error: error.message });
        }
    });

    socket.on('produce', async ({ kind, rtpParameters, transportId }, callback) => {
        if (typeof callback !== 'function') return;
        try {
            const transport = transports.get(transportId);
            if (!transport) throw new Error('Transport not found');
            // Close any existing producer for this socket
            producers.forEach((producer, id) => {
                if (producer.appData?.socketId === socket.id) {
                    producer.close();
                    producers.delete(id);
                    console.log(`Old producer ${id} closed for socket ${socket.id}`);
                }
            });
            const producer = await transport.produce({
                kind,
                rtpParameters,
                appData: { socketId: socket.id, roomId: socket.roomId }
            });
            producers.set(producer.id, producer);
            callback({ id: producer.id });
            socket.to(socket.roomId).emit('newProducer', { producerId: producer.id, userId: socket.id });
        } catch (error) {
            console.error('Error producing:', error);
            callback({ error: error.message });
        }
    });

    socket.on('consume', async ({ producerId, rtpCapabilities, transportId }, callback) => {
        if (typeof callback !== 'function') return;
        try {
            const transport = transports.get(transportId);
            if (!transport) throw new Error('Consumer transport not found');
            const producer = producers.get(producerId);
            if (!producer) throw new Error('Producer not found');
            if (!router.canConsume({ producerId, rtpCapabilities })) {
                throw new Error('Cannot consume this producer');
            }
            const consumer = await transport.consume({
                producerId,
                rtpCapabilities,
                paused: false,
                appData: { socketId: socket.id }
            });
            consumers.set(consumer.id, consumer);
            callback({
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters
            });
        } catch (error) {
            console.error('Error consuming:', error);
            callback({ error: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        const roomId = DeleteUser(socket.id);
        if (roomId) updateParticipants(roomId);

        transports.forEach((transport, id) => {
            if (transport.appData?.socketId === socket.id) {
                transport.close();
                transports.delete(id);
                console.log(`Transport ${id} closed for socket ${socket.id}`);
            }
        });
        producers.forEach((producer, id) => {
            if (producer.appData?.socketId === socket.id) {
                producer.close();
                producers.delete(id);
                console.log(`Producer ${id} closed for socket ${socket.id}`);
            }
        });
        consumers.forEach((consumer, id) => {
            if (consumer.appData?.socketId === socket.id) {
                consumer.close();
                consumers.delete(id);
                console.log(`Consumer ${id} closed for socket ${socket.id}`);
            }
        });
    });
});

// Update the list of participants in a room
const updateParticipants = (roomId) => {
    if (!roomId) return;
    const roomData = GetRoomById(roomId);
    if (roomData && roomData.users) {
        io.to(roomId).emit('updateParticipants', roomData.users);
    }
};

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
