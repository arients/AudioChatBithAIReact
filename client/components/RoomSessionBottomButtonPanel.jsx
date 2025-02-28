import React from 'react';

const RoomSessionBottomButtonPanel = ({ toggleMute, micEnabled, exitSession, terminateRoom, isAdmin }) => {
    return (
        <div className="bottom-panel">
            <button className="mute-button" onClick={toggleMute}>
                <i className="material-icons">
                    {micEnabled ? "mic" : "mic_off"}
                </i>
            </button>
            <button className="exit-button" onClick={exitSession}>
                <i className="material-icons">exit_to_app</i>
            </button>
            {isAdmin && (
                <>
                    <button className="terminate-button" onClick={terminateRoom}>
                        Terminate Room
                    </button>
                    <button className="bottom-button">
                        <i className="material-icons">add</i>
                    </button>
                </>
            )}
        </div>
    );
};

export default RoomSessionBottomButtonPanel;
