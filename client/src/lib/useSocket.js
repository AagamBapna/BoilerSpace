import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from './auth';

let socketInstance = null;

export function useSocket(user) {
    const socketRef = useRef(null);

    useEffect(() => {
        if (!user) return;

        const token = getToken();
        if (!token) return;

        if (socketInstance && socketInstance.connected) {
            socketRef.current = socketInstance;
            return;
        }

        const socket = io(window.location.origin.replace(/:\d+$/, ':5001'), {
            auth: { token },
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => { });
        socket.on('connect_error', () => { });

        socketInstance = socket;
        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketInstance = null;
            socketRef.current = null;
        };
    }, [user]);

    return socketRef;
}
