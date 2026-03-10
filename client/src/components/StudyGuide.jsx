import { useState } from 'react';
import axios from 'axios';

export default function StudyGuide({ courseId, courseName, onClose }) {
    const [studyGuide, setStudyGuide] = useState(null);
    const [error, setError] = useState(null);

    const handleGenerateStudyGuide = async () => {
        setError(null);
        setStudyGuide(null);
        try {
            const response = await axios.get(`/api/courses/${courseId}/study-guide`);
            setStudyGuide(response.data.studyGuide);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate study guide');
        }
    };
}