import React, { useEffect, useState } from "react";
import generateColorFromId from '../utils/generateColorFromId.js'

const RoomParticipant = ({ participant, micEnabled, currentUserId, onRemove }) => {
    const avatarColor = generateColorFromId(participant.userId);
    const [isLeaving, setIsLeaving] = useState(false);

    const initial = participant.userName ? participant.userName.charAt(0).toUpperCase() : "?";
    const isCurrentUser = participant.userId === currentUserId;
    const micStatus = participant.micStatus;

    const handleRemove = () => {
        setIsLeaving(true);
        setTimeout(() => {
            if (onRemove) {
                onRemove(participant.userId);
            }
        }, 300);
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!participant) {
                handleRemove();
            }
        }, 5000);
        return () => clearTimeout(timeout);
    }, [participant]);

    return (
        <div className={`participant-card ${isLeaving ? "exit" : ""}`}>
            <div className="avatar" style={{ backgroundColor: avatarColor }}>
                {initial}
                {participant.isTalking && <div className="talking-indicator"></div>}
            </div>
            <div className="participant-name">{participant.userName || participant.userId}</div>
            <div className="mic-status">
                <i className="material-icons">{micStatus ? "mic" : "mic_off"}</i>
            </div>
        </div>
    );
};

export default RoomParticipant;
