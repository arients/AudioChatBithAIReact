export default class Room {
    constructor(roomId) {
        this.roomId = roomId;
        this.users = [];
        this.adminUserId = null;
    }

    addUser(user) {
        // Prevent duplicate addition of the same user
        if (!this.users.find(u => u.userId === user.userId)) {
            this.users.push(user);
            if (!this.adminUserId) {
                this.adminUserId = user.userId;
            }
        }
    }

    removeUser(userId) {
        this.users = this.users.filter(user => user.userId !== userId);
        if (this.adminUserId === userId) {
            this.adminUserId = this.users.length > 0 ? this.users[0].userId : null;
        }
    }

    updateUserMicStatus(userId, micStatus) {
        const user = this.users.find(u => u.userId === userId);
        if (user) {
            user.micStatus = micStatus;
        }
    }

    updateUserTalkingStatus(userId, isTalking) {
        const user = this.users.find(u => u.userId === userId);
        if (user) {
            user.isTalking = isTalking;
        }
    }
}
