import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { pool } from './db/connection';
import commandRoutes from './api/commandRoutes';
import queryRoutes from './api/queryRoutes';
import projectionRoutes from './api/projectionRoutes';

dotenv.config();

const app = express();
const port = process.env.API_PORT || 8080;

app.use(cors());
app.use(express.json());

app.use('/api/accounts', commandRoutes);
app.use('/api/accounts', queryRoutes);
app.use('/api/projections', projectionRoutes);

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).send('OK');
    } catch (err) {
        res.status(503).send('Database unavailable');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
