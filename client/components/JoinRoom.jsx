import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket.jsx';

const JoinRoom = () => {
    const [roomId, setRoomId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleJoin = () => {
        if (roomId.trim()) {
            setLoading(true);
            socket.emit('checkRoom', { roomId }, (response) => {
                setTimeout(() => { // Имитация задержки перед выводом ошибки
                    setLoading(false);
                    if (response.exists) {
                        navigate(`/name?roomId=${roomId}`);
                    } else {
                        setError('Room ID does not exist');
                        setTimeout(() => setError(''), 3000);
                    }
                }, 1000);
            });
        }
    };

    const backToMenu = () => {
        navigate(`/`);
    };

    return (
        <>
            <button onClick={backToMenu} className="back-button" title="Back to menu">
                <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </button>

            <div className="join-room-container">
                <div className="join-room-card">
                    <h2>Join a Room</h2>
                    <input
                        type="text"
                        placeholder="Room ID"
                        value={roomId}
                        onChange={(e) => {
                            setRoomId(e.target.value);
                            setError('');
                        }}
                        className="join-room-input"
                        disabled={loading}
                    />
                    {error && <p className="error-message">{error}</p>}
                    <button
                        className={`join-room-button ${loading ? 'loading' : ''}`}
                        onClick={handleJoin}
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="loading-button flex items-center justify-center space-x-2">
                                <svg
                                    className="animate-spin h-5 w-5 text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"
                                    />
                                </svg>
                                <span>Joining...</span>
                            </div>
                        ) : (
                            "Join Room"
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

export default JoinRoom;