import React from 'react';

const RoomSessionBottomButtonPanel = ({ roomMenu, roomSettingsMenu, addAIMenu, toggleMute, micEnabled, exitSession, terminateRoom, role }) => {
    return (
        <div className="bottom-panel">
            <div className="left-panel">
                <button className="room-menu-button" onClick={roomMenu}>
                    <i className="material-icons" >menu</i>
                </button>
                {role === 'admin' && (
                    <>
                        <button className="add-button" onClick={addAIMenu}>
                            <i className="material-icons">add</i>
                        </button>
                    </>
                )}
                <button className="room-settings-button" onClick={roomSettingsMenu}>
                    <i className="material-icons" >settings</i>
                </button>
            </div>

            <div className="center-panel">
                <button className="mute-button" onClick={toggleMute}>
                    <i className="material-icons">
                        {micEnabled ? "mic" : "mic_off"}
                    </i>
                </button>
                <button className="exit-button" onClick={exitSession}>
                    <i className="material-icons">exit_to_app</i>
                </button>
            </div>

            <div className="right-panel">
                {role === 'admin' && (
                    <>
                        <button className="terminate-button" onClick={terminateRoom}>
                            Terminate Room
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default RoomSessionBottomButtonPanel;
