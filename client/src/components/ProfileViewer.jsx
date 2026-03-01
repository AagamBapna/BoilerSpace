import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ProfileViewer({ userId, user, onClose, onUserUpdate }) {
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [major, setMajor] = useState(user.major || '');
    const [year, setYear] = useState(user.year || '');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSaveProfile = async () => {
        setError(null);
        setSuccess(false);
        try {
            const res = await axios.put(`/api/users/${userId}`, {
                displayName,
                major,
                year,
            });
            setSuccess(true);
            setEditing(false);
            if (onUserUpdate) {
                onUserUpdate(res.data.user);
            }
        } catch (err) {
            if (err.response?.status === 401) {
                setError('You must be logged in to edit your profile.');
            } else if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to save profile. Please try again.');
            }
        }
    };

    const handleCancel = () => {
        setDisplayName(user.displayName || '');
        setMajor(user.major || '');
        setYear(user.year || '');
        setEditing(false);
        setError(null);
    };
}
