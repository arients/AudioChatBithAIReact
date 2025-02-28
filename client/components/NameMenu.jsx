import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socket from './socket.jsx';

const NameMenu = ({ onNameSubmit }) => {
    const [name, setName] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const roomId = searchParams.get('roomId');

    const handleSubmit = () => {
        if (name.trim() !== '') {
            socket.emit('updateName', { userName: name }, (response) => {
                if (response.success) {
                    onNameSubmit(name);
                    localStorage.setItem('userName', name);
                    if (roomId) {
                        socket.emit('joinRoom', { roomId, userName: name }, (res) => {
                            if (res.error) {
                                alert('Room does not exist.');
                            } else {
                                navigate(`/room/${roomId}`);
                            }
                        });
                    } else {
                        navigate('/');
                    }
                }
            });
        }
    };

    return (
        <div className="name-menu-container">
            <div className="name-menu-card">
                <h2>Join Room</h2>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="name-menu-input"
                />
                <button className="name-menu-button" onClick={handleSubmit}>Enter</button>
            </div>
        </div>
    );
};

export default NameMenu;
