import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RoomSessionBottomButtonPanel from './RoomSessionBottomButtonPanel.jsx';
import RoomParticipant from './RoomParticipant.jsx';
import { useAudioMonitoring } from '../hooks/useAudioMonitoring';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useMediaSetup } from '../hooks/useMediaSetup';
import calculateGridLayout from '../utils/calculateGridLayout.js';
import socket from "../socket.jsx";
import RoomAddAIMenu from "./RoomAddAIMenu.jsx";
import RoomMenu from "./RoomMenu.jsx";
import RoomSettingsMenu from "./RoomSettingsMenu.jsx";
import modelSettings from '../utils/aiProperties.js';
import RoomAIParticipant from "./RoomAIParticipant.jsx";

const Room = ({ userName }) => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
    const [isAddAIMenuOpen, setIsAddAIMenuOpen] = useState(false);
    const [isWindowActive, setIsWindowActive] = useState(true);

    // Состояние конфигурации AI
    const [aiConfig, setAiConfig] = useState({
        voice: modelSettings.voice.selected,
        instructions: modelSettings.communicationStyle.selected,
        temperature: modelSettings.temperature,
    });

    // Инициализация медиапотока, девайса и продьюсера
    const {
        localStream,
        micEnabled,
        setMicEnabled,
        deviceRef,
        producerRef,
        producerTransportRef,
        restartLocalStream
    } = useMediaSetup(roomId, isWindowActive);

    // Инициализация сокет-соединения и получение данных комнаты
    const { participants, userId, role, remoteStreams } = useRoomSocket(roomId, userName, deviceRef);

    // Мониторинг уровня аудио (уже используется для обновления статуса говорящего)
    useAudioMonitoring(localStream, isWindowActive);

    // Обработка смены аудио устройств из настроек
    useEffect(() => {
        const handleAudioDeviceChange = (event) => {
            // Перезапуск локального потока с новым устройством
            restartLocalStream(event.detail.inputDeviceId);
        };

        window.addEventListener('audioDeviceChanged', handleAudioDeviceChange);

        return () => {
            window.removeEventListener('audioDeviceChanged', handleAudioDeviceChange);
        };
    }, [restartLocalStream]);

    const toggleMute = () => {
        if (localStream) {
            const track = localStream.getAudioTracks()[0];
            track.enabled = !track.enabled;
            setMicEnabled(track.enabled);
            socket.emit('updateMicStatus', { micStatus: track.enabled }, (response) => {
                if (!response.success) {
                    console.error('Failed to update mic status');
                }
            });
        }
    };

    const cleanupResources = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }

        if (producerRef.current) {
            producerRef.current.close();
        }

        if (producerTransportRef.current) {
            producerTransportRef.current.close();
        }

        if (deviceRef.current?.producer) {
            deviceRef.current.producer.close();
        }

        if (deviceRef.current?.producerTransport) {
            deviceRef.current.producerTransport.close();
        }

        if (deviceRef.current?.consumers) {
            Object.values(deviceRef.current.consumers).forEach(consumer => consumer.close());
        }

        if (deviceRef.current?.consumerTransports) {
            Object.values(deviceRef.current.consumerTransports).forEach(transport => transport.close());
        }
        socket.disconnect();
    };

    const exitRoom = () => {
        cleanupResources();
        navigate('/');
    };

    const terminateRoom = () => {
        socket.emit('terminateRoom', { roomId }, (response) => {
            if (response.error) {
                alert(response.error);
            }
        });
    };

    // Обработка события завершения комнаты администратором
    useEffect(() => {
        const handleRoomTerminated = () => {
            cleanupResources();
            navigate('/');
            alert("The room has been terminated by the admin.");
        };

        socket.on('roomTerminated', handleRoomTerminated);
        return () => {
            socket.off('roomTerminated', handleRoomTerminated);
        };
    }, [navigate]);

    // Настройка аудио выходов для новых аудио потоков
    useEffect(() => {
        const applyAudioOutputDevice = async () => {
            const selectedOutputId = localStorage.getItem('selectedOutputDeviceId');

            if (selectedOutputId && typeof HTMLMediaElement.prototype.setSinkId === 'function') {
                const audioElements = document.querySelectorAll('audio');

                for (const audioEl of audioElements) {
                    try {
                        if (audioEl.sinkId !== selectedOutputId) {
                            await audioEl.setSinkId(selectedOutputId);
                        }
                    } catch (error) {
                        console.error('Ошибка при изменении устройства вывода:', error);
                    }
                }
            }
        };

        applyAudioOutputDevice();
    }, [remoteStreams]);

    const gridLayout = calculateGridLayout(participants.length);

    // Обработка обновления конфигурации AI
    const updateAiConfig = (newConfig) => {
        setAiConfig(newConfig);
    };

    const roomContainerClass = `room-container ${isMenuOpen ? 'menu-open' : ''}`;

    const gridStyles = {
        display: 'grid',
        gap: '10px',
        height: '100%',
        ...gridLayout,
        transition: 'all 0.3s ease'
    };

    /* ======================================================================
       Новый блок: запись аудио с обнаружением тишины и отправка на сервер
       ====================================================================== */
    useEffect(() => {
        if (!localStream) return;

        let mediaRecorder;
        let audioChunks = [];
        let silenceTimeout = null;
        let isRecording = false;

        // Создаём новый MediaStream из аудиодорожки локального потока, чтобы не мешать другим процессам
        const audioStream = new MediaStream(localStream.getAudioTracks());

        try {
            mediaRecorder = new MediaRecorder(audioStream);
        } catch (error) {
            console.error('Ошибка создания MediaRecorder:', error);
            return;
        }

        // Собираем чанки аудио данных
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        // При остановке записи собираем данные в Blob и отправляем на сервер для транскрипции
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = []; // сброс чанков

            const reader = new FileReader();
            reader.onloadend = () => {
                const arrayBuffer = reader.result;
                socket.emit('whisperAudioToText', { roomId: roomId, audioBuffer: arrayBuffer }, (error, transcriptionText) => {
                    if (error) {
                        console.error('Transcription error:', error);
                    } else {
                        console.log('Transcription:', transcriptionText);
                        // Здесь можно обновить UI, например, отобразить текст транскрипции
                    }
                });
            };
            reader.readAsArrayBuffer(audioBlob);
        };

        // Создаём аудио-контекст и анализатор для определения уровня громкости
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        const source = audioContext.createMediaStreamSource(localStream);
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Функция для мониторинга уровня звука и управления записью
        const monitorAudio = () => {
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((acc, value) => acc + value, 0);
            const average = sum / dataArray.length;
            const threshold = 25; // порог для определения речи

            if (average > threshold) {
                // Если звук обнаружен, начинаем запись (если запись ещё не шла)
                if (!isRecording) {
                    mediaRecorder.start();
                    isRecording = true;
                    // Если таймер тишины был запущен, сбрасываем его
                    if (silenceTimeout) {
                        clearTimeout(silenceTimeout);
                        silenceTimeout = null;
                    }
                } else if (silenceTimeout) {
                    // Если запись уже идёт, сбрасываем таймер остановки
                    clearTimeout(silenceTimeout);
                    silenceTimeout = null;
                }
            } else {
                // Если обнаружена тишина и запись идёт, запускаем таймер на 2 секунды
                if (isRecording && !silenceTimeout) {
                    silenceTimeout = setTimeout(() => {
                        if (mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                        }
                        isRecording = false;
                        silenceTimeout = null;
                    }, 1000);
                }
            }

            requestAnimationFrame(monitorAudio);
        };

        monitorAudio();

        return () => {
            if (silenceTimeout) clearTimeout(silenceTimeout);
            audioContext.close();
        };
    }, [localStream]);
    /* ====================================================================== */

    socket.on('aiResponse', (data) => {
        console.log('Ответ ИИ:', data.transcription); // Выводим ответ ИИ в консоль
        const audio = new Audio("data:audio/mpeg;base64," + data.voice);
        audio.volume = 0.3;
        audio.play().catch(err => console.error('Ошибка при воспроизведении аудио:', err));
    });
    return (
        <>
            {isSettingsMenuOpen && <RoomSettingsMenu onClose={() => setIsSettingsMenuOpen(false)} />}
            {isMenuOpen && <RoomMenu roomId={roomId} onClose={() => setIsMenuOpen(false)} participants={participants} currentUserId={userId} role={role} />}
            {isAddAIMenuOpen && (
                <RoomAddAIMenu
                    roomId={roomId}
                    onClose={() => setIsAddAIMenuOpen(false)}
                    config={aiConfig}
                    updateConfig={updateAiConfig}
                    modelSettings={modelSettings}
                />
            )}

            <div className={roomContainerClass}>
                <div className="participants-grid" style={gridStyles}>
                    {participants.map((participant) => {
                        return participant.isAI
                            ? <RoomAIParticipant
                                key={participant.userId}
                                aiParticipant={participant}
                                onMute={(id) => socket.emit('muteAI', { aiId: id, roomId: participant.roomId, micStatus: participant.micStatus })}
                                onKick={(id) => socket.emit('kickAI', { aiId: id, roomId: participant.roomId }, (response) => {})}
                            />
                            : <RoomParticipant
                                key={participant.userId}
                                participant={participant}
                                currentUserId={userId}
                                micEnabled={micEnabled}
                            />;
                    })}
                </div>

                <div className="remote-audio">
                    {Object.entries(remoteStreams).map(([remoteUserId, stream]) => (
                        <audio
                            key={remoteUserId}
                            autoPlay
                            playsInline
                            ref={(audio) => {
                                if (audio && audio.srcObject !== stream) {
                                    audio.srcObject = stream;
                                    const selectedOutputId = localStorage.getItem('selectedOutputDeviceId');
                                    if (selectedOutputId && audio.setSinkId) {
                                        audio.setSinkId(selectedOutputId).catch(err => {
                                            console.error('Failed to set audio output device:', err);
                                        });
                                    }
                                }
                            }}
                        />
                    ))}
                </div>

                <RoomSessionBottomButtonPanel
                    roomMenu={() => setIsMenuOpen(true)}
                    roomSettingsMenu={() => setIsSettingsMenuOpen(true)}
                    addAIMenu={() => setIsAddAIMenuOpen(true)}
                    toggleMute={toggleMute}
                    micEnabled={micEnabled}
                    exitSession={exitRoom}
                    terminateRoom={terminateRoom}
                    role={role}
                />
            </div>
        </>
    );
};

export default Room;