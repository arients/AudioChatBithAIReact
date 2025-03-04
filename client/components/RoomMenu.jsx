import React, { useState, useEffect, useRef } from 'react';
import socket from "../socket.jsx";
import generateColorFromId from "../utils/generateColorFromId.js";

const RoomMenu = ({ roomId, onClose, participants, currentUserId, role }) => {
    const isAdmin = role === 'admin';
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const menuRef = useRef(null);
    const contextMenuRef = useRef(null);

    // Анимация появления меню
    useEffect(() => {
        const timer = setTimeout(() => {
            if (menuRef.current) {
                menuRef.current.classList.add('menu-visible');
                document.body.classList.add('menu-open');
            }
        }, 10);
        return () => {
            clearTimeout(timer);
            document.body.classList.remove('menu-open');
        };
    }, []);

    // Закрытие контекстного меню при клике вне его области
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
                setShowContextMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleClose = () => {
        if (menuRef.current) {
            menuRef.current.classList.remove('menu-visible');
            document.body.classList.remove('menu-open');
            setTimeout(onClose, 300);
        } else {
            onClose();
        }
    };

    // Обработка клика правой кнопкой по участнику
    const handleParticipantContextMenu = (e, participant) => {
        e.preventDefault(); // Отмена стандартного контекстного меню
        if (!isAdmin) return;
        if(participant.isAI) return;

        setSelectedParticipant(participant);
        setContextMenuPosition({
            x: e.clientX,
            y: e.clientY
        });
        setShowContextMenu(true);
    };

    // Изменение роли участника (админ ↔ обычный пользователь)
    const handleRoleChange = () => {
        const newRole = selectedParticipant.role === 'admin' ? 'participant' : 'admin';
        socket.emit('updateUserRole', { roomId, targetUserId: selectedParticipant.userId, newRole }, (response) => {
            if (!response.success) {
                alert(`Error: ${response.error || 'Failed to change user role'}`);
            }
        });
        setShowContextMenu(false);
    };

    // Изменение разрешений для AI
    const handleAIPermissionChange = (targetUserId, field, value) => {
        if (!isAdmin) return;
        socket.emit('updateAIPermissions', {
            roomId,
            targetUserId,
            permission: field,
            value
        }, (response) => {
            if (!response.success) {
                alert(`Error: ${response.error || 'Failed to update AI permissions'}`);
            }
        });
    };

    return (
        <>
            <div className="room-menu-overlay" onClick={handleClose}></div>
            <div ref={menuRef} className="room-menu-container">
                <div className="room-menu-header">
                    <h2>Participants</h2>
                    <button className="close-button" onClick={handleClose}>×</button>
                </div>

                <ul className="participants-list">
                    {participants.length > 0 ? (
                        participants.map((participant) => (
                            <li
                                key={participant.userId}
                                className={`participant-item ${participant.role === 'admin' ? 'admin' : ''}`}
                                onContextMenu={(e) => handleParticipantContextMenu(e, participant)}
                            >
                                <div
                                    className="participant-avatar"
                                    style={{ backgroundColor: generateColorFromId(participant.userId) }}
                                >
                                    {participant.userName.charAt(0).toUpperCase()}
                                </div>
                                <div className="participant-info">
                                    <span className="participant-name">{participant.userName}</span>
                                    {participant.role === 'admin' && <span className="admin-badge">Admin</span>}
                                    {participant.userId === currentUserId && <span className="you-badge">(You)</span>}
                                    {participant.isAI && <span className="you-badge ai-badge">(AI)</span>}
                                </div>
                                {!participant.isAI &&
                                <div className="ai-permissions">
                                    <label className="ai-permission-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={participant.canHearAI ?? true}
                                            onChange={(e) =>
                                                handleAIPermissionChange(participant.userId, 'canHearAI', e.target.checked)
                                            }
                                            disabled={!isAdmin}
                                        />
                                        <span className="checkbox-label">Can Hear AI</span>
                                    </label>
                                    <label className="ai-permission-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={participant.canTalkToAI ?? true}
                                            onChange={(e) =>
                                                handleAIPermissionChange(participant.userId, 'canTalkToAI', e.target.checked)
                                            }
                                            disabled={!isAdmin}
                                        />
                                        <span className="checkbox-label">Can Talk to AI</span>
                                    </label>
                                </div>
                                }
                            </li>
                        ))
                    ) : (
                        <li className="no-participants">No participants</li>
                    )}
                </ul>
            </div>

            {showContextMenu && selectedParticipant && (
                <div
                    ref={contextMenuRef}
                    className="context-menu"
                    style={{
                        left: `${contextMenuPosition.x}px`,
                        top: `${contextMenuPosition.y}px`
                    }}
                >
                    {selectedParticipant.role === 'admin' ? (
                        <button onClick={handleRoleChange}>Make regular user</button>
                    ) : (
                        <button onClick={handleRoleChange}>Make administrator</button>
                    )}
                </div>
            )}
        </>
    );
};

export default RoomMenu;
