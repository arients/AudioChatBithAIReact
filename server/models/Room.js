// Room.js (модель комнаты)
// Добавлено хранение aiConfig (при необходимости) – остальное осталось без изменений.
export default class Room {
    constructor(roomId, adminUserId = null) {
        this.roomId = roomId;
        this.users = [];
        this.adminUserId = adminUserId;
        this.roles = {};
        this.aiPermissions = {};
        this.aiSession = null; // Объект для сессии ИИ (с историей и настройками)
        // Если требуется, можно добавить отдельное поле для aiConfig
        this.aiConfig = null;
        // История диалога, если используется (теперь хранится внутри aiSession)
        this.conversationLog = "";
        if (adminUserId) {
            this.roles[adminUserId] = 'admin';
            this.aiPermissions[adminUserId] = {
                canHearAI: true,
                canTalkToAI: true
            };
        }
    }

setAISession(aiSessionData) {
        this.aiSession = aiSessionData;
    }

    getAISession() {
        return this.aiSession;
    }

    removeAISession() {
        this.aiSession = null;
    }

    addUser(user) {
        // Prevent duplication
        if (!this.users.find(u => u.userId === user.userId)) {
            // Add role property to user object
            const userWithRole = {
                ...user,
                role: this.roles[user.userId] || 'participant',
                canHearAI: this.aiPermissions[user.userId]?.canHearAI ?? true,
                canTalkToAI: this.aiPermissions[user.userId]?.canTalkToAI ?? true
            };

            this.users.push(userWithRole);

            // If admin doesn't exist yet, make this user admin,
            // otherwise add with 'participant' role
            if (!this.adminUserId) {
                this.adminUserId = user.userId;
                this.roles[user.userId] = 'admin';
            } else {
                // If user already exists, don't overwrite admin role
                if (!this.roles[user.userId]) {
                    this.roles[user.userId] = 'participant';
                }
            }

            // Initialize AI permissions if they don't exist
            if (!this.aiPermissions[user.userId]) {
                this.aiPermissions[user.userId] = {
                    canHearAI: true,
                    canTalkToAI: true
                };
            }
        }
    }

    removeUser(userId) {
        this.users = this.users.filter(user => user.userId !== userId);
        delete this.roles[userId];
        delete this.aiPermissions[userId];

        if (this.adminUserId === userId) {
            // If admin leaves the room, assign the first remaining user as admin
            if (this.users.length > 0) {
                this.adminUserId = this.users[0].userId;
                this.roles[this.adminUserId] = 'admin';
            } else {
                this.adminUserId = null;
            }
        }
    }

    updateUserRole(userId, newRole, requestUserId) {
        // Only allow admins to update roles
        if (this.roles[requestUserId] !== 'admin') {
            return { error: "Only admins can change roles" };
        }

        if (this.roles[userId] !== undefined) {
            this.roles[userId] = newRole;

            // Update role in users array for immediate UI update
            const userIndex = this.users.findIndex(u => u.userId === userId);
            if (userIndex !== -1) {
                this.users[userIndex].role = newRole;
            }

            // If changing to 'admin', update adminUserId
            if (newRole === 'admin') {
                this.adminUserId = userId;
            } else if (this.adminUserId === userId && newRole !== 'admin') {
                // If admin demotes themselves, you can implement additional logic
                // for choosing a new admin - here we leave the existing value.
            }
            return { success: true };
        }
        return { error: "User not found" };
    }

    updateAIPermissions(userId, permission, value) {
        if (!this.aiPermissions[userId]) {
            this.aiPermissions[userId] = {
                canHearAI: true,
                canTalkToAI: true
            };
        }

        this.aiPermissions[userId][permission] = value;

        // Update permissions in users array for immediate UI update
        const userIndex = this.users.findIndex(u => u.userId === userId);
        if (userIndex !== -1) {
            this.users[userIndex][permission] = value;
        }

        return { success: true };
    }

}