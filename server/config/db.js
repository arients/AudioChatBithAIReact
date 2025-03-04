import User from '../models/User.js';
import Room from '../models/Room.js';
import { v4 as uuidv4 } from "uuid";

const users = [];
const rooms = [];


/**
 * Создаёт нового пользователя.
 * @param {string} userId – Уникальный идентификатор.
 * @param {string} userName – Имя пользователя.
 */
export const CreateNewUser = (userId, userName = "") => {
    if (users.some(user => user.userId === userId)) {
        console.log('⚠️ User already exists!');
        return;
    }
    const newUser = new User(userId, userName);
    users.push(newUser);
};

/**
 * Преобразует UUID в 8-значный идентификатор.
 * @param {string} uuid – UUID (например, от uuidv4).
 * @returns {string} 8-значный идентификатор.
 */
export const convertUuidTo8DigitId = (uuid) => {
    // Убираем символы "-" из UUID
    const cleanUuid = uuid.replace(/-/g, '');

    // Берем первые 8 символов и преобразуем их в число
    const id = parseInt(cleanUuid.substring(0, 6), 16); // Преобразуем в число из 16-ричной системы

    // Если число получилось меньше 8 знаков, добавляем ведущие нули
    return id.toString().padStart(6, '0');
};

/**
 * Обновляет имя пользователя.
 */
export const UpdateUserName = (userId, newName) => {
    const user = users.find(u => u.userId === userId);
    if (user) {
        user.userName = newName;
        console.log(`✅ User ${userId} name updated to ${newName}`);
    }
};

/**
 * Обновляет статус микрофона пользователя.
 */
export const UpdateUserMicStatus = (userId, micStatus) => {
    const user = users.find(u => u.userId === userId);
    if (user) {
        user.micStatus = micStatus;
        console.log(`✅ User ${userId} mic status updated to ${micStatus}`);

        // Находим комнату, в которой находится пользователь
        const room = rooms.find(room => room.roomId === user.currentRoom);
        if (room) {
            const roomUser = room.users.find(u => u.userId === userId);
            if (roomUser) {
                roomUser.micStatus = micStatus;
            }
        }
    }
};

export const UpdateUserTalkingStatus = (userId, isTalking) => {
    const user = users.find(u => u.userId === userId);
    if (user) {
        user.isTalking = isTalking;
        console.log(`✅ User ${userId} talking status updated to ${isTalking}`);

        // Находим комнату, в которой находится пользователь
        const room = rooms.find(room => room.roomId === user.currentRoom);
        if (room) {
            const roomUser = room.users.find(u => u.userId === userId);
            if (roomUser) {
                roomUser.isTalking = isTalking;
            }
        }
    }
};


/**
 * Удаляет пользователя.
 * Удаляет пользователя из комнаты, если он присутствует.
 */
export const DeleteUser = (userId) => {
    const index = users.findIndex(user => user.userId === userId);
    if (index !== -1) {
        const user = users[index];
        const roomId = user.currentRoom;
        rooms.forEach(room => {
            if (room.roomId === roomId) {
                room.removeUser(userId);
                console.log(`✅ User ${userId} removed from room ${roomId}`);
            }
        });
        users.splice(index, 1);
        console.log(`✅ User ${userId} deleted.`);
        return roomId;
    }
    console.log('⚠️ User does not exist!');
    return null;
};

/**
 * Создаёт новую комнату.
 * Принимает идентификатор создателя, который становится адміном.
 */
export const CreateRoom = (creatorUserId) => {
    const roomId = convertUuidTo8DigitId(uuidv4());
    const newRoom = new Room(roomId, creatorUserId);
    rooms.push(newRoom);
    return newRoom;
};

/**
 * Добавляет пользователя в комнату.
 */
export const AddUserToRoom = (roomId, userId, userName = "") => {
    const room = rooms.find(room => room.roomId === roomId);
    const user = users.find(user => user.userId === userId);
    if (!room) {
        console.log('⚠️ Room not found!');
        return;
    }
    if (!user) {
        console.log('⚠️ User not found!');
        return;
    }
    if (userName && userName.trim() !== "") {
        user.userName = userName;
    }
    if (user.currentRoom === roomId) {
        console.log(`⚠️ User ${userId} is already in room ${roomId}`);
        return;
    }
    user.currentRoom = roomId;
    room.addUser(user);
    console.log(`✅ User ${userId} added to room ${roomId}`);
};

/**
 * Завершает работу комнаты – удаляет комнату и сбрасывает currentRoom у пользователей.
 */
export const TerminateRoom = (roomId) => {
    const roomIndex = rooms.findIndex(room => room.roomId === roomId);
    if (roomIndex !== -1) {
        const room = rooms[roomIndex];
        room.users.forEach(user => {
            user.currentRoom = null;
        });
        rooms.splice(roomIndex, 1);
        console.log(`✅ Room ${roomId} terminated.`);
    }
};

export const GetRoomById = (roomId) => {
    return rooms.find(room => room.roomId === roomId) || null;
};

/**
 * Обновлённая функция получения пользователя по userId.
 */
export const GetUserById = (userId) => {
    return users.find(user => user.userId === userId) || null;
};

export const GetUsers = () => users;
export const GetRooms = () => rooms;
