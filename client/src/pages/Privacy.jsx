import React, { useEffect, useState } from 'react';
import api from '../api';

const Privacy = () => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/site-settings')
            .then(res => {
                setContent(res.data.privacyContent);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    return (
        <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem', minHeight: '60vh' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>Privacy Policy</h1>
            {loading ? (
                <p style={{ textAlign: 'center', color: '#666' }}>Loading...</p>
            ) : (
                <div style={{ lineHeight: '1.8', color: '#333', whiteSpace: 'pre-wrap' }}>
                    {content || (
                        <p style={{ textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                            Privacy policy has not been updated yet.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Privacy;
