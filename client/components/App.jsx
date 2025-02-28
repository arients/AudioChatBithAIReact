import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Menu from './Menu.jsx';
import JoinRoom from './JoinRoom.jsx';
import NameMenu from './NameMenu.jsx';
import Room from './Room.jsx';

const ProtectedRoomRoute = ({ userName }) => {
    const { roomId } = useParams();
    return userName ? <Room userName={userName} /> : <Navigate to={`/name?roomId=${roomId}`} />;
};

const App = () => {
    // Global state for storing the user name.
    const [userName, setUserName] = useState('');

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Menu />} />
                <Route path="/join" element={<JoinRoom />} />
                <Route path="/name" element={<NameMenu onNameSubmit={(name) => setUserName(name)} />} />
                <Route path="/room/:roomId" element={<ProtectedRoomRoute userName={userName} />} />
            </Routes>
        </Router>
    );
};

export default App;
