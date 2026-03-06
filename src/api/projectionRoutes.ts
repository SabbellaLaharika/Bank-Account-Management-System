import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { Projector } from '../infrastructure/Projector';

const router = Router();
const projector = new Projector();

router.post('/rebuild', async (req: Request, res: Response) => {
    try {
        // Send accepted response immediately
        res.status(202).json({ message: 'Projection rebuild initiated.' });

        // Run rebuild async
        projector.rebuildAll().catch(err => {
            console.error('Projection rebuild failed:', err);
        });

    } catch (error: any) {
        // Will only reach here if standard synchronous setup throws
        res.status(500).json({ error: error.message });
    }
});

router.get('/status', async (req: Request, res: Response) => {
    try {
        const { rows: eventsCountRow } = await pool.query('SELECT COUNT(*) FROM events');
        const totalEventsInStore = parseInt(eventsCountRow[0].count);

        const { rows: accountSummariesRow } = await pool.query('SELECT COALESCE(MAX(version), 0) as max_v FROM account_summaries');
        const summariesProcessed = parseInt(accountSummariesRow[0].max_v);

        res.status(200).json({
            totalEventsInStore,
            projections: [
                {
                    name: 'AccountSummaries',
                    lastProcessedEventNumberGlobal: summariesProcessed,
                    lag: Math.max(0, totalEventsInStore - summariesProcessed) // Simple heuristic, actual correct lag measurement is complex
                },
                {
                    name: 'TransactionHistory',
                    lastProcessedEventNumberGlobal: summariesProcessed, // tied to summaries largely
                    lag: Math.max(0, totalEventsInStore - summariesProcessed)
                }
            ]
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
