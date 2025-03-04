import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socket from '../socket.jsx';

const NameMenu = ({ onNameSubmit }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const roomId = searchParams.get('roomId');

    const handleSubmit = () => {
        if (name.trim() !== '') {
            setLoading(true); // Блокируем кнопку и запускаем анимацию
            socket.emit('updateName', { userName: name }, (response) => {
                setTimeout(() => { // Имитация задержки перед обработкой ответа
                    if (response.success) {
                        onNameSubmit(name);
                        localStorage.setItem('userName', name);
                        if (roomId) {
                            navigate(`/room/${roomId}`);
                        } else {
                            navigate('/');
                        }
                    } else {
                        setLoading(false);
                    }
                }, 500);
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
                    onChange={(e) => {
                        if (e.target.value.length <= 15) {
                            setName(e.target.value);
                        }
                    }}
                    placeholder="Enter your name"
                    className="name-menu-input"
                    disabled={loading}
                />
                <button
                    className={`name-menu-button ${loading ? 'loading' : ''}`}
                    onClick={handleSubmit}
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
                        "Enter"
                    )}
                </button>
            </div>
        </div>
    );
};

export default NameMenu;
