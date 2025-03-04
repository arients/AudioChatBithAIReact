// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import mediasoup from 'mediasoup';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import FormData from 'form-data';
import axios from "axios";
import fs from 'fs';
dotenv.config();
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Import in‐memory database functions
import {
    CreateRoom,
    AddUserToRoom,
    CreateNewUser,
    DeleteUser,
    GetRoomById,
    GetUserById,
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

const isDev = process.env.NODE_ENV === 'dev';
const conversationTimers = new Map();

if (!isDev) {
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

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

    socket.on('getUserId', (callback) => {
        if (typeof callback === 'function') {
            callback(socket.id);
        }
    });

    socket.on('updateName', ({ userName }, callback) => {
        UpdateUserName(socket.id, userName);
        const roomId = socket.roomId;
        if (roomId) {
            updateParticipants(roomId);
        }
        callback({ success: true });
    });

    socket.on('updateMicStatus', ({ micStatus }, callback) => {
        UpdateUserMicStatus(socket.id, micStatus);
        const roomId = socket.roomId;
        if (roomId) {
            updateParticipants(roomId);
        }
        callback({ success: true });
    });

    socket.on('updateTalkingStatus', ({ isTalking }, callback) => {
        UpdateUserTalkingStatus(socket.id, isTalking);
        const roomId = socket.roomId;
        if (roomId) {
            updateParticipants(roomId);
        }
        callback({ success: true });
    });

    socket.on('createRoom', (callback) => {
        const room = CreateRoom(socket.id);
        if (typeof callback === 'function') {
            callback({ roomId: room.roomId });
        } else {
            socket.emit('roomCreated', { roomId: room.roomId });
        }
    });

    socket.on('getRole', ({ roomId, userId }, callback) => {
        const room = GetRoomById(roomId);
        if (!room) {
            callback({ error: "Room not found" });
            return;
        }
        const role = room.roles[userId] || 'participant';
        callback({ role });
    });

    socket.on('updateUserRole', ({ roomId, targetUserId, newRole }, callback) => {
        const room = GetRoomById(roomId);
        if (!room) {
            callback({ error: "Room not found" });
            return;
        }
        const isAdmin = room.roles[socket.id] === 'admin';
        if (!isAdmin) {
            callback({ error: "Only admin can update user roles" });
            return;
        }
        if (newRole === 'admin' && room.adminUserId !== socket.id) {
            callback({ error: "Cannot assign admin role to another user" });
            return;
        }
        room.roles[targetUserId] = newRole;
        console.log(`🔄 Role updated: ${targetUserId} is now ${newRole}`);
        io.to(targetUserId).emit('roleUpdated', { userId: targetUserId, newRole });
        updateParticipants(roomId);
        callback({ success: true });
    });

    socket.on('updateAIPermissions', ({ roomId, targetUserId, permission, value }, callback) => {
        const room = GetRoomById(roomId);
        if (!room) {
            callback({ error: "Room not found" });
            return;
        }
        const isAdmin = room.roles[socket.id] === 'admin';
        const isSelf = socket.id === targetUserId;
        if (!isAdmin && !isSelf) {
            callback({ error: "You don't have permission to change other users' settings" });
            return;
        }
        if (!room.aiPermissions[targetUserId]) {
            room.aiPermissions[targetUserId] = {
                canHearAI: true,
                canTalkToAI: true
            };
        }
        if (permission === 'canHearAI' || permission === 'canTalkToAI') {
            room.aiPermissions[targetUserId][permission] = value;
            console.log(`🔄 AI Permission updated: ${targetUserId} ${permission} set to ${value}`);
            io.to(targetUserId).emit('aiPermissionUpdated', {
                userId: targetUserId,
                permission,
                value
            });
            updateParticipants(roomId);
            callback({ success: true });
        } else {
            callback({ error: "Invalid permission type" });
        }
    });

    socket.on('joinRoom', ({ roomId, userName }, callback) => {
        if (!roomId || !socket.id) {
            console.error('Invalid joinRoom data:', { roomId, socketId: socket.id });
            callback({ error: 'Invalid room or user ID' });
            return;
        }
        const room = GetRoomById(roomId);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        AddUserToRoom(roomId, socket.id, userName);
        if (!room.roles[socket.id]) {
            room.roles[socket.id] = 'participant';
        }
        if (!room.aiPermissions[socket.id]) {
            room.aiPermissions[socket.id] = {
                canHearAI: true,
                canTalkToAI: true
            };
        }
        socket.join(roomId);
        socket.roomId = roomId;
        updateParticipants(roomId);
        sendExistingProducers(socket, roomId);
        callback({ success: true });
    });

    socket.on('getParticipants', (data, callback) => {
        const roomId = socket.roomId;
        if (!roomId) {
            callback({ error: 'The user is not in any room.' });
            return;
        }
        const room = GetRoomById(roomId);
        if (!room) {
            callback({ error: 'Room not found.' });
            return;
        }
        const participantsWithDetails = room.users.map(user => {
            const isAI = user.userId.slice(0, 2).toLowerCase() === 'ai';
            return {
                ...user,
                role: room.roles[user.userId] || 'participant',
                canHearAI: room.aiPermissions[user.userId]?.canHearAI ?? true,
                canTalkToAI: room.aiPermissions[user.userId]?.canTalkToAI ?? true,
                isAI: isAI
            };
        });
        callback({ participants: participantsWithDetails });
    });

    socket.on('terminateRoom', ({ roomId }, callback) => {
        const room = GetRoomById(roomId);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        if (room.roles[socket.id] !== 'admin') {
            callback({ error: 'Only admin can terminate the room' });
            return;
        }
        TerminateRoom(roomId);
        io.to(roomId).emit('roomTerminated');
        callback({ success: true });
    });

    socket.on('checkRoom', ({ roomId }, callback) => {
        const room = GetRoomById(roomId);
        if (room) {
            callback({ exists: true });
        } else {
            callback({ exists: false });
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
            // Закрываем предыдущего продьюсера для этого сокета, если есть
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

    // ===== AI events =====

    // Create AI (ограничение: в комнате может быть только один ИИ)
    socket.on('createAI', ({ roomId, config }, callback = () => {}) => {
        if (!roomId) {
            callback({ success: false, error: "Room ID not provided" });
            return;
        }
        const room = GetRoomById(roomId);
        if (!room) {
            callback({ success: false, error: "Room not found" });
            return;
        }
        if (room.aiSession) {
            callback({ success: false, error: "AI already exists in this room" });
            return;
        }
        // Save the AI configuration in the room so that all users have the same settings
        room.aiConfig = config;
        const aiId = `ai-${uuidv4()}`;
        console.log("Creating AI with config:", config);
        CreateNewUser(aiId, "AI Assistant");
        AddUserToRoom(roomId, aiId, "AI Assistant");
        // Create a persistent session for the AI with a message history and a buffer for new input
        room.aiSession = {
            aiId,
            config,
            connected: true,
            messages: [],
            pendingUserMessage: ""
        };
        updateParticipants(roomId);
        callback({ success: true, aiId });
    });

    socket.on('muteAI', ({ aiId, roomId, micStatus }, callback = () => {}) => {
        const newMicStatus = !micStatus;
        UpdateUserMicStatus(aiId, newMicStatus);

        const roomIdd = socket.roomId;
        if (roomIdd) {
            updateParticipants(roomIdd);
        }

        callback({ success: true, newMicStatus });
    });


    // Кик ИИ – теперь проверяем, что запрошенный aiId соответствует активной сессии
    socket.on('kickAI', ({ aiId, roomId }, callback) => {
        const roomIdd = socket.roomId;
        if (!roomIdd) {
            callback({ success: false, error: "Room ID not provided" });
            return;
        }
        const room = GetRoomById(roomIdd);
        if (!room) {
            callback({ success: false, error: "Room not found" });
            return;
        }
        if (!room.aiSession || room.aiSession.aiId !== aiId) {
            callback({ success: false, error: "AI not found in room" });
            return;
        }
        DeleteUser(aiId);
        room.aiSession = null;
        updateParticipants(roomIdd);
        callback({ success: true });
    });

    // Обработка голосовых сообщений для ИИ с накоплением контекста
    socket.on('whisperAudioToText', async ({ roomId, audioBuffer }, callback) => {
        console.log(`[whisperAudioToText] Запуск обработчика. roomId: ${roomId}, socketId: ${socket.id}`);
        if (!roomId) {
            console.error('[whisperAudioToText] Room ID не предоставлен');
            callback({ success: false, error: "Room ID not provided" });
            return;
        }
        const room = GetRoomById(roomId);
        if (!room) {
            console.error('[whisperAudioToText] Комната не найдена');
            callback({ success: false, error: "Room not found" });
            return;
        }
        if (!room.aiSession) {
            console.error('[whisperAudioToText] Нет активного ИИ в комнате');
            callback({ success: false, error: "No AI in room" });
            return;
        }
        if (!room.aiPermissions[socket.id]?.canTalkToAI) {
            console.error('[whisperAudioToText] Пользователь не имеет права общаться с ИИ');
            callback({ success: false, error: "User is not allowed to speak to AI" });
            return;
        }
        // Получаем объект ИИ по его идентификатору
        const aiUser = room.users.find(user => user.userId === room.aiSession.aiId);
        if (!aiUser) {
            console.error('[whisperAudioToText] ИИ не найден в комнате');
            callback({ success: false, error: "AI not found in room" });
            return;
        }
        if (!aiUser.micStatus) {
            console.error('[whisperAudioToText] Микрофон ИИ выключен');
            callback({ success: false, error: "AI Mic Off" });
            return;
        }
        let audioFilePath;
        const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
        try {
            console.log('[whisperAudioToText] Сохранение аудиобуфера во временный файл...');
            audioFilePath = saveAudioBufferToFile(audioBuffer);
            console.log(`[whisperAudioToText] Файл сохранён: ${audioFilePath}`);

            const formData = new FormData();
            formData.append('file', fs.createReadStream(audioFilePath));
            formData.append('model', 'whisper-1');
            console.log('[whisperAudioToText] Отправка запроса к Whisper API...');
            const response = await axios.post(OPENAI_API_URL, formData, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    ...formData.getHeaders(),
                },
            });
            console.log('[whisperAudioToText] Получена транскрипция от Whisper API:', response.data.text);
            const userName = GetUserById(socket.id)?.userName || "Unknown";
            const transcriptionText = `[${userName}]: ${response.data.text}`;

            // Добавляем транскрипцию в буфер для отправки ИИ
            room.aiSession.pendingUserMessage += transcriptionText + "\n";
            console.log('[whisperAudioToText] Обновлён pendingUserMessage:', room.aiSession.pendingUserMessage);

            // Сбрасываем предыдущий таймер, если есть
            if (conversationTimers.has(roomId)) {
                console.log('[whisperAudioToText] Очистка предыдущего таймера.');
                clearTimeout(conversationTimers.get(roomId));
            }

            const sendChatIfSilent = async () => {
                console.log('[sendChatIfSilent] Проверка, говорит ли кто-либо в комнате...');
                const anyTalking = room.users.some(user => user.isTalking === true);
                if (anyTalking) {
                    console.log('[sendChatIfSilent] Обнаружено, что кто-то говорит. Перезапуск таймера.');
                    const newTimer = setTimeout(sendChatIfSilent, 1500);
                    conversationTimers.set(roomId, newTimer);
                    return;
                }
                const pending = room.aiSession.pendingUserMessage.trim();
                console.log('[sendChatIfSilent] pendingUserMessage:', pending);
                if (pending !== "") {
                    let messages = [];
                    if (room.aiConfig && room.aiConfig.instructions) {
                        messages.push({ role: "system", content: room.aiConfig.instructions });
                        console.log('[sendChatIfSilent] Добавлено системное сообщение:', room.aiConfig.instructions);
                    }
                    messages = messages.concat(room.aiSession.messages || []);
                    messages.push({ role: "user", content: pending });
                    console.log('[sendChatIfSilent] Отправка сообщений в ChatGPT:', messages);
                    try {
                        const chatResponse = await axios.post(
                            "https://api.openai.com/v1/chat/completions",
                            {
                                model: "gpt-3.5-turbo",
                                messages: messages,
                                max_tokens: 1000,
                                temperature: room.aiSession.config.temperature,
                            },
                            {
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                                }
                            }
                        );
                        const aiResponseText = chatResponse.data.choices?.[0]?.message?.content?.trim() || "No response";
                        console.log('[sendChatIfSilent] Получен ответ от ChatGPT:', aiResponseText);
                        // Обновляем историю сообщений
                        room.aiSession.messages.push({ role: "user", content: pending });
                        room.aiSession.messages.push({ role: "assistant", content: aiResponseText });
                        room.aiSession.pendingUserMessage = "";
                        // Конвертируем ответ ИИ в голос
                        console.log('[sendChatIfSilent] Конвертация ответа ИИ в голос...');
                        const voiceBuffer = await convertTextToVoice(room, aiResponseText);
                        const voiceBase64 = voiceBuffer.toString('base64');
                        const responseData = {
                            transcription: aiResponseText,
                            voice: voiceBase64
                        };
                        console.log('[sendChatIfSilent] Отправка aiResponse в комнату:', responseData);
                        io.to(roomId).emit('aiResponse', responseData);
                    } catch (chatError) {
                        console.error("[sendChatIfSilent] Ошибка при вызове ChatGPT API или конвертации текста в голос:", chatError);
                    }
                }
                conversationTimers.delete(roomId);
            };
            const timerId = setTimeout(sendChatIfSilent, 1000);
            conversationTimers.set(roomId, timerId);
            console.log('[whisperAudioToText] Таймер установлен, ожидаем тишины...');
            callback(null, transcriptionText);
        } catch (error) {
            console.error('[whisperAudioToText] Ошибка при транскрипции аудио:', error);
            callback(error);
        } finally {
            if (audioFilePath) {
                fs.unlink(audioFilePath, (err) => {
                    if (err) console.error(`Ошибка удаления файла ${audioFilePath}:`, err);
                    else console.log(`[whisperAudioToText] Файл ${audioFilePath} успешно удалён`);
                });
            }
        }
    });


    const saveAudioBufferToFile = (audioBuffer) => {
        const fileName = `audio_${crypto.randomBytes(16).toString('hex')}.wav`;
        const filePath = path.join(__dirname, 'temp', fileName);
        fs.writeFileSync(filePath, audioBuffer);
        return filePath;
    };

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

const updateParticipants = (roomId) => {
    if (!roomId) return;
    const room = GetRoomById(roomId);
    if (!room || !room.users) return;
    const participantsWithDetails = room.users.map(user => {
        const isAI = user.userId.slice(0, 2).toLowerCase() === 'ai';
        return {
            ...user,
            role: room.roles[user.userId] || 'participant',
            canHearAI: room.aiPermissions[user.userId]?.canHearAI ?? true,
            canTalkToAI: room.aiPermissions[user.userId]?.canTalkToAI ?? true,
            isAI: isAI
        };
    });
    io.to(roomId).emit('updateParticipants', participantsWithDetails);
};

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
    console.log("Received SIGINT. Shutting down gracefully.");
    for (const [id, socket] of io.of("/").sockets) {
        socket.disconnect(true);
    }
    server.close(() => {
        console.log("HTTP server closed.");
        if (worker) {
            worker.close();
        }
        process.exit(0);
    });
    setTimeout(() => {
        console.error("Force shutdown.");
        process.exit(1);
    }, 10000);
});

// Stub for text-to-speech conversion using OpenAI's TTS API.
async function convertTextToVoice(room, text) {
    try {
        const mp3Response = await openai.audio.speech.create({
            model: 'tts-1-hd',      // Можно заменить на 'tts-1-hd' для более качественного звука
            voice: `${room.aiConfig.voice}`,
            input: text,
        });
        const buffer = Buffer.from(await mp3Response.arrayBuffer());
        return buffer;
    } catch (error) {
        console.error('Error converting text to voice:', error);
        throw error;
    }
}
