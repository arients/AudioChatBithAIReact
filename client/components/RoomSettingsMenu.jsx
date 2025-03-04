import React, { useState, useEffect, useRef } from 'react';

const RoomSettingsMenu = ({ onClose }) => {
    const [inputDevices, setInputDevices] = useState([]);
    const [outputDevices, setOutputDevices] = useState([]);
    const [selectedInputDevice, setSelectedInputDevice] = useState('');
    const [selectedOutputDevice, setSelectedOutputDevice] = useState('');
    const [initialInputDevice, setInitialInputDevice] = useState('');
    const [initialOutputDevice, setInitialOutputDevice] = useState('');
    const modalRef = useRef(null);

    useEffect(() => {
        getDevices();

        const timer = setTimeout(() => {
            if (modalRef.current) {
                modalRef.current.classList.add('settings-menu-visible');
            }
        }, 10);

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

        // Add event listener to detect clicks outside of the modal
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearTimeout(timer);
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const getDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();

            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

            setInputDevices(audioInputs);
            setOutputDevices(audioOutputs);

            const currentInput = localStorage.getItem('selectedInputDeviceId') || '';
            const currentOutput = localStorage.getItem('selectedOutputDeviceId') || '';

            const inputExists = audioInputs.some(device => device.deviceId === currentInput);
            const outputExists = audioOutputs.some(device => device.deviceId === currentOutput);

            const defaultInput = inputExists ? currentInput : (audioInputs[0]?.deviceId || '');
            const defaultOutput = outputExists ? currentOutput : (audioOutputs[0]?.deviceId || '');

            setSelectedInputDevice(defaultInput);
            setSelectedOutputDevice(defaultOutput);
            setInitialInputDevice(defaultInput);
            setInitialOutputDevice(defaultOutput);
        } catch (error) {
            console.error('Ошибка при получении медиа устройств:', error);
        }
    };

    const handleDeviceChange = async () => {
        await getDevices();
    };

    const handleClickOutside = (event) => {
        if (modalRef.current && !modalRef.current.contains(event.target)) {
            handleClose();
        }
    };

    const handleSave = () => {
        localStorage.setItem('selectedInputDeviceId', selectedInputDevice);
        localStorage.setItem('selectedOutputDeviceId', selectedOutputDevice);

        const event = new CustomEvent('audioDeviceChanged', {
            detail: {
                inputDeviceId: selectedInputDevice,
                outputDeviceId: selectedOutputDevice
            }
        });
        window.dispatchEvent(event);

        handleClose();
    };

    const handleClose = () => {
        if (modalRef.current) {
            modalRef.current.classList.remove('settings-menu-visible');
            setTimeout(onClose, 300);
        } else {
            onClose();
        }
    };

    return (
        <div className="settings-menu-overlay">
            <div ref={modalRef} className="settings-menu-container">
                <h2>Audio settings</h2>

                <div className="settings-section">
                    <label htmlFor="inputDevice">Input device (microphone):</label>
                    <select
                        id="inputDevice"
                        value={selectedInputDevice}
                        onChange={(e) => setSelectedInputDevice(e.target.value)}
                    >
                        {inputDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${inputDevices.indexOf(device) + 1}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="settings-section">
                    <label htmlFor="outputDevice">Output device (speakers):</label>
                    <select
                        id="outputDevice"
                        value={selectedOutputDevice}
                        onChange={(e) => setSelectedOutputDevice(e.target.value)}
                    >
                        {outputDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Speaker ${outputDevices.indexOf(device) + 1}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="settings-buttons">
                    <button
                        className="settings-button cancel"
                        onClick={handleClose}
                    >
                        Exit
                    </button>
                    <button
                        className="settings-button save"
                        onClick={handleSave}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoomSettingsMenu;
