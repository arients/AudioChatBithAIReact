import { useEffect } from 'react';
import socket from '../socket.jsx';

export const useAudioMonitoring = (localStream, isWindowActive) => {
    useEffect(() => {
        if (!localStream || !isWindowActive) return;

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
    }, [localStream, isWindowActive]);
};
