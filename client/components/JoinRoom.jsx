import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from './socket.jsx';

const JoinRoom = () => {
    const [roomId, setRoomId] = useState('');
    const [name, setName] = useState('');
    const navigate = useNavigate();

    const handleJoin = () => {
        if (roomId.trim() && name.trim()) {
            socket.emit('updateName', { userName: name }, (response) => {
                if (response.success) {
                    localStorage.setItem('userName', name);
                    socket.emit('joinRoom', { roomId, userName: name }, (res) => {
                        if (res.error) {
                            alert('Room does not exist.');
                        } else {
                            navigate(`/room/${roomId}`);
                        }
                    });
                }
            });
        }
    };

    return (
        <div className="join-room-container">
            <div className="join-room-card">
                <h2>Join a Room</h2>
                <input
                    type="text"
                    placeholder="Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="join-room-input"
                />
                <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="join-room-input"
                />
                <button className="join-room-button" onClick={handleJoin}>Join Room</button>
            </div>
        </div>
    );
};

export default JoinRoom;
