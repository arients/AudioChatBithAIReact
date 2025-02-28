import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from './socket.jsx';

const Menu = () => {
    const navigate = useNavigate();

    useEffect(() => {
        if (!socket.connected) {
            socket.connect();
        }
    }, []);

    const handleCreateRoom = () => {
        socket.emit('createRoom');
        socket.on('roomCreated', ({ roomId }) => {
            navigate(`/name?roomId=${roomId}`);
        });
    };

    const handleJoinRoom = () => {
        navigate('/join');
    };

    return (
        <div className="menu-container">
            <div className="menu-card">
                <h2>Welcome to Voice Chat</h2>
                <div className="menu-buttons">
                    <button className="menu-button" onClick={handleCreateRoom}>Create Room</button>
                    <button className="menu-button" onClick={handleJoinRoom}>Join Room</button>
                </div>
            </div>
        </div>
    );
};

export default Menu;
