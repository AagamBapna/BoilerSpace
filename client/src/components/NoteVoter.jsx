import { useState } from 'react';
import axios from 'axios';

export default function NoteVoter({ noteId, initialVotes, userVote }) {
    const [voteCount, setVoteCount] = useState(initialVotes);
    const [currentUserVote, setCurrentUserVote] = useState(userVote);
    const handleVote = async (vote) => {
        try {
            if (currentUserVote === vote) {
                await axios.delete(`/api/notes/${noteId}/vote`);
                if (vote === 'up') {
                    setVoteCount(prev => prev - 1);
                } else {
                    setVoteCount(prev => prev + 1);
                }
                setCurrentUserVote(null);
            } else {
                const response = await axios.post(`/api/notes/${noteId}/vote`, { vote });
                setVoteCount(response.data.voteCount);
                setCurrentUserVote(response.data.userVote);
            }
        } catch (error) {
            console.error('Error placing vote:', error);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '32px' }}>
        <button onClick={() => handleVote('up')} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px',
            color: currentUserVote === 'up' ? 'var(--color-purdue-gold)' : 'var(--color-text-secondary)',
            transition: 'color 0.2s',
        }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-8 8h5v8h6v-8h5z"/>
            </svg>
        </button>
        <span style={{
            fontWeight: 'bold', fontSize: '13px', textAlign: 'center',
            color: voteCount > 0 ? 'var(--color-purdue-gold)' : voteCount < 0 ? '#ef4444' : 'var(--color-text-secondary)',
        }}>{voteCount}</span>
        <button onClick={() => handleVote('down')} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px',
            color: currentUserVote === 'down' ? '#ef4444' : 'var(--color-text-secondary)',
            transition: 'color 0.2s',
        }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 20l8-8h-5V4H9v8H4z"/>
            </svg>
        </button>
        </div>
    );
}