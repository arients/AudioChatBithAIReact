import React, { useEffect, useRef, useState } from 'react';
import socket from "../socket.jsx";
const RoomAddAIMenu = ({ roomId, onClose, config, updateConfig, modelSettings }) => {
    const modalRef = useRef(null);
    const [isCreatingAI, setIsCreatingAI] = useState(false);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

    useEffect(() => {
        // Анимация появления меню
        const timer = setTimeout(() => {
            if (modalRef.current) {
                modalRef.current.classList.add('ai-menu-visible');
            }
        }, 10);

        return () => {
            clearTimeout(timer);
        };
    }, []);

    const handleClose = () => {
        // Анимация исчезновения меню
        if (modalRef.current) {
            modalRef.current.classList.remove('ai-menu-visible');
            setTimeout(onClose, 300);
        } else {
            onClose();
        }
    };

    const handleCreateAi = () => {
        setIsCreatingAI(true);
        // Отправляем запрос на создание ИИ на сервере с передачей настроек aiConfig
        socket.emit('createAI', { roomId: roomId, config: config }, (response) => {
            if (response.success) {
                console.log('AI created');
            } else {
                console.error('AI creation error:', response.error);
            }
            setIsCreatingAI(false);
        });
    };


    const handleGeneratePrompt = () => {
        setIsGeneratingPrompt(true);

        socket.emit('promptInstruction', {}, (response) => {
            setIsGeneratingPrompt(false);

            if (response.success) {
                config.instructions = response.instruction;
            } else {
                console.error("Error generating instruction:", response.error);
            }
        });
    };

    const handleStyleChange = (value) => {
        updateConfig({ ...config, instructions: value });
    };

    return (
        <div className="ai-menu-overlay" onClick={handleClose}>
            <div
                ref={modalRef}
                className="ai-menu-container"
                onClick={(e) => e.stopPropagation()}
            >
                <h2>AI Settings</h2>
                <div className="ai-menu-content">
                    {/* Выбор голоса */}
                    <div className="ai-menu-item">
                        <label>Voice Type</label>
                        <select
                            value={config.voice}
                            onChange={(e) => updateConfig({ ...config, voice: e.target.value })}
                            className="ai-menu-select"
                        >
                            {modelSettings.voice.options.map((voice) => (
                                <option key={voice.value} value={voice.value}>
                                    {voice.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Выбор стиля общения */}
                    <div className="ai-menu-item">
                        <label>Communication Style</label>
                        <select
                            value={config.instructions}
                            onChange={(e) => handleStyleChange(e.target.value)}
                            className="ai-menu-select"
                        >
                            {modelSettings.communicationStyle.options.map((style) => (
                                <option key={style.value} value={style.value}>
                                    {style.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Поле для кастомных инструкций */}
                    <div className="ai-menu-item ai-settings-menu-instruction-field">
                        <label>Instruction</label>
                        <span className="text-xs text-gray-500">
                            {config.instructions.length}/1000
                        </span>
                        <textarea
                            value={config.instructions}
                            onChange={(e) =>
                                updateConfig({ ...config, instructions: e.target.value.slice(0, 1000) })
                            }
                            placeholder="Enter custom instructions..."
                            className="ai-menu-textarea"
                        />
                    </div>

                    {/* Кнопка генерации промта */}
                    <button
                        className={`ai-settings-menu-generate-prompt-button ${isGeneratingPrompt ? 'loading' : ''}`}
                        onClick={handleGeneratePrompt}
                        disabled={isGeneratingPrompt}
                    >
                        {isGeneratingPrompt ? (
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
                                <span>Generating...</span>
                            </div>
                        ) : (
                            "Generate Prompt"
                        )}
                    </button>

                    {/* Ползунок температуры */}
                    <div className="ai-menu-item temperature-container">
                        <div className="temperature-label">
                            <label>Temperature ({config.temperature})</label>
                            <span>
                                {config.temperature === 0.8
                                    ? "Balanced responses"
                                    : config.temperature < 0.8
                                        ? "Conservative responses"
                                        : "Creative responses"}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.6"
                            max="1.2"
                            step="0.1"
                            value={config.temperature}
                            onChange={(e) =>
                                updateConfig({ ...config, temperature: parseFloat(e.target.value) })
                            }
                            className="ai-menu-slider"
                        />
                    </div>
                </div>

                {/* Кнопка создания ИИ */}
                <button
                    className={`ai-settings-menu-create-button ${isCreatingAI ? 'loading' : ''}`}
                    onClick={handleCreateAi}
                    disabled={isCreatingAI}
                >
                    {isCreatingAI ? (
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
                            <span>Creating...</span>
                        </div>
                    ) : (
                        "Create AI"
                    )}
                </button>

                <button className="ai-settings-menu-close-button" onClick={handleClose}>
                    CLOSE
                </button>
            </div>
        </div>
    );
};

export default RoomAddAIMenu;
