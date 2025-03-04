import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket.jsx';

export const useRoomSocket = (roomId, userName, deviceRef) => {
    const navigate = useNavigate();
    const [participants, setParticipants] = useState([]);
    const [userId, setUserId] = useState(null);
    const [role, setRole] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const joinedRef = useRef(false);

    const updateLocalParticipants = (users) => {
        setParticipants(users || []);
    };

    const createConsumerTransport = async () => {
        try {
            const data = await new Promise((resolve) => {
                socket.emit('createConsumerTransport', { roomId }, (response) => resolve(response));
            });
            if (!data) throw new Error('No consumer transport data received');
            const transport = deviceRef.current.createRecvTransport(data);
            transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                socket.emit('connectConsumerTransport', { dtlsParameters, transportId: transport.id }, (response) => {
                    if (response?.success) callback();
                    else errback(new Error('Failed to connect consumer transport'));
                });
            });
            return transport;
        } catch (error) {
            console.error('Error creating consumer transport:', error);
            return null;
        }
    };

    useEffect(() => {
        const initSocket = async () => {
            try {
                const id = await new Promise((resolve) => {
                    socket.emit('getUserId', (id) => resolve(id));
                });
                setUserId(id);

                socket.emit('getRole', { roomId, userId: id }, (response) => {
                    if (response?.role) {
                        setRole(response.role);
                    }
                });

                socket.on('roleUpdated', ({ userId: updatedUserId, newRole }) => {
                    if (updatedUserId === id) {
                        setRole(newRole);
                    }
                });

                if (!joinedRef.current) {
                    joinedRef.current = true;
                    socket.emit('joinRoom', { roomId, userName }, (response) => {
                        if (response.error) {
                            alert(response.error);
                            navigate('/');
                        }
                    });
                }
            } catch (error) {
                console.error('Error initialising socket:', error);
            }
        };

        initSocket();

        socket.on('updateParticipants', (users) => {
            updateLocalParticipants(users);
        });

        socket.on('roomTerminated', () => {
            navigate('/');
        });

        const handleProducer = async ({ producerId, userId: remoteUserId }, isExisting = false) => {
            try {
                const transport = await createConsumerTransport();
                if (!transport) throw new Error('Failed to create consumer transport');
                socket.emit(
                    'consume',
                    {
                        producerId,
                        rtpCapabilities: deviceRef.current?.rtpCapabilities,
                        transportId: transport.id
                    },
                    async (data) => {
                        if (data?.error) {
                            console.error(`Failed to consume ${isExisting ? 'existing' : 'new'} producer:`, data.error);
                            return;
                        }
                        const consumer = await transport.consume({
                            id: data.id,
                            producerId: data.producerId,
                            kind: data.kind,
                            rtpParameters: data.rtpParameters
                        });
                        const stream = new MediaStream([consumer.track]);
                        setRemoteStreams(prev => ({ ...prev, [remoteUserId]: stream }));
                    }
                );
            } catch (error) {
                console.error(`Error handling ${isExisting ? 'existing' : 'new'} producer:`, error);
            }
        };

        socket.on('newProducer', (data) => {
            handleProducer(data, false);
        });

        socket.on('existingProducer', (data) => {
            handleProducer(data, true);
        });

        return () => {
            socket.off('updateParticipants');
            socket.off('newProducer');
            socket.off('existingProducer');
            socket.off('roleUpdated');
        };
    }, [roomId, userName, navigate, deviceRef]);

    useEffect(() => {
        socket.on('aiResponseAudio', (audioData) => {
            // Создаем Blob и URL для аудио
            const blob = new Blob([audioData], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(blob);
            const audioElement = new Audio(audioUrl);
            audioElement.play();
        });
        return () => {
            socket.off('aiResponseAudio');
        };
    }, []);

    return { participants, userId, role, remoteStreams };
};
