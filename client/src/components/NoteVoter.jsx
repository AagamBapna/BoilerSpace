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
}