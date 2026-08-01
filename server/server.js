import app from './app.js';
import { initializeDatabase } from './db.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to initialize the database schema:', error);
        process.exit(1);
    }
};

startServer();
