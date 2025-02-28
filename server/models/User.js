export default class User {
    constructor(userId, userName) {
        this.userId = userId;
        this.userName = userName;
        this.currentRoom = null;
        this.micStatus = true; // Microphone is enabled by default
        this.isTalking = false; // Not talking by default
    }
}
