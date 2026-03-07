import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { pool } from './db/connection';
import commandRoutes from './api/commandRoutes';
import queryRoutes from './api/queryRoutes';
import projectionRoutes from './api/projectionRoutes';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.API_PORT || 8080;

// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));

app.use(cors());
app.use(express.json());

// Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
