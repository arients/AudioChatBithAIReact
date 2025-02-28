import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from './socket.jsx';
import RoomSessionBottomButtonPanel from './RoomSessionBottomButtonPanel.jsx';
import RoomParticipant from './RoomParticipant.jsx';
import { Device } from 'mediasoup-client';

const Room = ({ userName }) => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [participants, setParticipants] = useState([]);
    const [userId, setUserId] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [micEnabled, setMicEnabled] = useState(true);
    const [remoteStreams, setRemoteStreams] = useState({});
    const deviceRef = useRef(null);
    const producerTransportRef = useRef(null);
    const consumerTransportsRef = useRef(new Map());
    const producerRef = useRef(null);
    const joinedRef = useRef(false); // Flag to avoid double join

    // Update local participants list
    const updateLocalParticipants = (users) => {
        setParticipants(users || []);
    };

    // After obtaining the local stream, monitor audio levels
    useEffect(() => {
        if (localStream) {
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(localStream);
            microphone.connect(analyser);
            analyser.fftSize = 512;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let talking = false;
            const threshold = 10;

            const monitorAudio = () => {
                analyser.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((acc, value) => acc + value, 0);
                const average = sum / dataArray.length;
                if (average > threshold && !talking) {
                    talking = true;
                    socket.emit('updateTalkingStatus', { isTalking: true }, (response) => {
                        if (!response.success) {
                            console.error('Failed to update talking status to true');
                        }
                    });
                } else if (average <= threshold && talking) {
                    talking = false;
                    socket.emit('updateTalkingStatus', { isTalking: false }, (response) => {
                        if (!response.success) {
                            console.error('Failed to update talking status to false');
                        }
                    });
                }
                requestAnimationFrame(monitorAudio);
            };

            monitorAudio();

            return () => {
                audioContext.close();
            };
        }
    }, [localStream]);

    useEffect(() => {
        const initSocket = async () => {
            try {
                const id = await new Promise((resolve) => {
                    socket.emit('getUserId', (id) => resolve(id));
                });
                setUserId(id);
                // Join room only once
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
            alert('Room has been terminated by the admin.');
            navigate('/');
        });

        socket.on('newProducer', async ({ producerId, userId: remoteUserId }) => {
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
                            console.error('Failed to consume producer:', data.error);
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
                console.error('Error handling new producer:', error);
            }
        });

        socket.on('existingProducer', async ({ producerId, userId: remoteUserId }) => {
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
                            console.error('Failed to consume existing producer:', data.error);
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
                console.error('Error handling existing producer:', error);
            }
        });

        return () => {
            socket.off('updateParticipants');
            socket.off('newProducer');
            socket.off('existingProducer');
            cleanupResources();
        };
    }, [roomId, userName]);

    useEffect(() => {
        const initDeviceAndMedia = async () => {
            try {
                deviceRef.current = new Device();
                const routerRtpCapabilities = await new Promise((resolve) => {
                    socket.emit('getRouterRtpCapabilities', (caps) => resolve(caps));
                });
                if (!routerRtpCapabilities) throw new Error('Failed to get router RTP capabilities');
                await deviceRef.current.load({ routerRtpCapabilities });
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    setLocalStream(stream);
                    setMicEnabled(true);
                    await setupProducer(stream);
                } catch (micError) {
                    console.error('Microphone access denied:', micError);
                    setMicEnabled(false);
                }
            } catch (error) {
                console.error('Error initialising device:', error);
            }
        };
        initDeviceAndMedia();
    }, []);

    const setupProducer = async (stream) => {
        try {
            if (producerRef.current) {
                producerRef.current.close();
                producerRef.current = null;
            }
            if (producerTransportRef.current) {
                producerTransportRef.current.close();
                producerTransportRef.current = null;
            }
            const transport = await createProducerTransport();
            if (!transport) throw new Error('Failed to create producer transport');
            producerTransportRef.current = transport;
            const producer = await transport.produce({ track: stream.getAudioTracks()[0] });
            producerRef.current = producer;
        } catch (error) {
            console.error('Error setting up producer:', error);
        }
    };

    const createProducerTransport = async () => {
        try {
            const data = await new Promise((resolve) => {
                socket.emit('createProducerTransport', { roomId }, (response) => resolve(response));
            });
            if (!data) throw new Error('No producer transport data received');
            const transport = deviceRef.current.createSendTransport(data);
            transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                socket.emit('connectProducerTransport', { dtlsParameters, transportId: transport.id }, (response) => {
                    if (response?.success) callback();
                    else errback(new Error('Failed to connect producer transport'));
                });
            });
            transport.on('produce', ({ kind, rtpParameters }, callback) => {
                socket.emit('produce', { kind, rtpParameters, transportId: transport.id }, callback);
            });
            return transport;
        } catch (error) {
            console.error('Error creating producer transport:', error);
            return null;
        }
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
            consumerTransportsRef.current.set(transport.id, transport);
            return transport;
        } catch (error) {
            console.error('Error creating consumer transport:', error);
            return null;
        }
    };

    const cleanupResources = () => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            setLocalStream(null);
        }
        if (producerRef.current) {
            producerRef.current.close();
            producerRef.current = null;
        }
        if (producerTransportRef.current) {
            producerTransportRef.current.close();
            producerTransportRef.current = null;
        }
        consumerTransportsRef.current.forEach((transport) => transport.close());
        consumerTransportsRef.current.clear();
        socket.disconnect();
    };

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

    const calculateGridLayout = (count) => {
        switch(count) {
            case 1: return { gridTemplate: '1fr / 1fr' };
            case 2: return { gridTemplate: '1fr / repeat(2, 1fr)' };
            case 3: return {
                gridTemplate: 'repeat(2, 1fr) / 1fr 1fr'
            };
            case 4: return { gridTemplate: 'repeat(2, 1fr) / repeat(2, 1fr)' };
            default: {
                const columns = Math.ceil(Math.sqrt(count));
                const rows = Math.ceil(count / columns);
                return {
                    gridTemplate: `repeat(${rows}, 1fr) / repeat(${columns}, 1fr)`
                };
            }
        }
    };

    const gridLayout = calculateGridLayout(participants.length);
    const gridStyles = {
        display: 'grid',
        gap: '10px',
        height: '100%',
        ...gridLayout
    };

    return (
        <div className="room-container">
            <div className="participants-grid" style={gridStyles}>
                {participants.map((participant) => (
                    <RoomParticipant
                        key={participant.userId}
                        participant={participant}
                        currentUserId={userId}
                        micEnabled={micEnabled}
                    />
                ))}
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
                            }
                        }}
                    />
                ))}
            </div>

            <RoomSessionBottomButtonPanel
                toggleMute={toggleMute}
                micEnabled={micEnabled}
                exitSession={exitRoom}
                terminateRoom={terminateRoom}
            />
        </div>
    );
};

export default Room;
