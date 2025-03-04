import React from 'react';
import generateColorFromId from '../utils/generateColorFromId';

const RoomAIParticipant = ({ aiParticipant, onMute, onKick }) => {
    const avatarColor = generateColorFromId(aiParticipant.userId);
    // Для аватара можно использовать фиксированное значение или первую букву, например "А"
    const initial = "А";
    const headset_mic = aiParticipant.micStatus;

    return (
        <div className="participant-card ai-participant">
            <div className="avatar" style={{ backgroundColor: avatarColor }}>
                {initial}
            </div>
            <div className="participant-name">{aiParticipant.userName}</div>
            <div className="ai-participant-controls">
                <button className="mute-button" onClick={() => onMute(aiParticipant.userId)}>
                    <span className="material-icons">
                        {headset_mic ? "headset_mic" : "headset_off"}
                    </span>
                </button>
                <button className="exit-button" onClick={() => onKick(aiParticipant.userId)}>
                    <i className="material-icons">logout</i>
                </button>
            </div>
        </div>
    );
};

export default RoomAIParticipant;
