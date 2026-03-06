import { useState } from 'react';
import axios from 'axios';

export default function NoteVoter({ noteId, initialVotes, userVote }) {
    const [voteCount, setVoteCount] = useState(initialVotes);
    const [currentUserVote, setCurrentUserVote] = useState(userVote);
    const handleVote = async (type) => {
        try {
            const response = await axios.post(`/api/notes/${noteId}/vote`, { type });
            setVoteCount(response.data.voteCount);
            setCurrentUserVote(response.data.userVote);
        } catch (error) {
            console.error('Error placing vote:', error);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '32px' }}>
        <button onClick={() => handleVote('up')} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px',
            color: userVote === 'up' ? 'var(--color-purdue-gold)' : 'var(--color-text-secondary)',
            transition: 'color 0.2s',
        }}>▲</button>
        <span style={{
            fontWeight: 'bold', fontSize: '13px', textAlign: 'center',
            color: voteCount > 0 ? 'var(--color-purdue-gold)' : voteCount < 0 ? '#ef4444' : 'var(--color-text-secondary)',
        }}>{voteCount}</span>
        <button onClick={() => handleVote('down')} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px',
            color: userVote === 'down' ? '#ef4444' : 'var(--color-text-secondary)',
            transition: 'color 0.2s',
        }}>▼</button>
        </div>
    );
}