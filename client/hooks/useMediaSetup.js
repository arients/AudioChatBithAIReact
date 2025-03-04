import { useEffect, useState, useRef, useCallback } from 'react';
import socket from '../socket.jsx';
import { Device } from 'mediasoup-client';

export const useMediaSetup = (roomId, isWindowActive) => {
    const [localStream, setLocalStream] = useState(null);
    const [micEnabled, setMicEnabled] = useState(false);
    const deviceRef = useRef(null);
    const producerTransportRef = useRef(null);
    const producerRef = useRef(null);

    const setupProducer = useCallback(async (stream) => {
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
    }, [roomId]);

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

        // Only initialise media if the window is active
        if (isWindowActive) {
            initDeviceAndMedia();
        }

        // Cleanup on unmount
        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [roomId, isWindowActive, setupProducer]);

    const restartLocalStream = useCallback(async (inputDeviceId) => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        try {
            const constraints = {
                audio: inputDeviceId ? { deviceId: { exact: inputDeviceId } } : true,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            setMicEnabled(true);
            await setupProducer(stream);
        } catch (error) {
            console.error('Failed to restart local stream:', error);
            setMicEnabled(false);
        }
    }, [localStream, setupProducer]);

    return { localStream, micEnabled, setLocalStream, setMicEnabled, deviceRef, producerRef, producerTransportRef, restartLocalStream };
};
