import User from '../models/User.js';
import Room from '../models/Room.js';
import { v4 as uuidv4 } from "uuid";

const users = [];
const rooms = [];

/**
 * Creates a new user.
 * @param {string} userId – Unique identifier.
 * @param {string} userName – User's name.
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
 * Updates the user's name.
 */
export const UpdateUserName = (userId, newName) => {
    const user = users.find(u => u.userId === userId);
    if (user) {
        user.userName = newName;
        console.log(`✅ User ${userId} name updated to ${newName}`);
    }
};

/**
 * Updates the user's microphone status.
 */
export const UpdateUserMicStatus = (userId, micStatus) => {
    const user = users.find(u => u.userId === userId);
    if (user) {
        user.micStatus = micStatus;
        console.log(`✅ User ${userId} mic status updated to ${micStatus}`);
    }
};

/**
 * Updates the user's talking status.
 */
export const UpdateUserTalkingStatus = (userId, isTalking) => {
    const user = users.find(u => u.userId === userId);
    if (user) {
        user.isTalking = isTalking;
        console.log(`✅ User ${userId} talking status updated to ${isTalking}`);
    }
};

/**
 * Deletes a user.
 * Removes the user from the room if present.
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
 * Creates a new room.
 */
export const CreateRoom = () => {
    const roomId = uuidv4();
    const newRoom = new Room(roomId);
    rooms.push(newRoom);
    return newRoom;
};

/**
 * Adds a user to a room.
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
 * Terminates a room – deletes the room and resets users' currentRoom.
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

export const GetUsers = () => users;
export const GetRooms = () => rooms;
