import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { EventStore } from '../infrastructure/EventStore';
import { BankAccount } from '../domain/BankAccount';
import { Projector } from '../infrastructure/Projector';

const router = Router();
const eventStore = new EventStore();
const projector = new Projector();

router.get('/:accountId', async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;

        const { rows } = await pool.query(
            'SELECT account_id as "accountId", owner_name as "ownerName", balance, currency, status FROM account_summaries WHERE account_id = $1',
            [accountId as string]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const account = rows[0];
        account.balance = Number(account.balance); // Ensure numeric format

        res.status(200).json(account);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:accountId/transactions', async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;

        if (page < 1 || pageSize < 1) {
            return res.status(400).json({ error: 'Invalid pagination parameters' });
        }

        const offset = (page - 1) * pageSize;

        // Ensure account exists
        const { rows: accountRows } = await pool.query('SELECT 1 FROM account_summaries WHERE account_id = $1', [accountId as string]);
        if (accountRows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM transaction_history WHERE account_id = $1', [accountId as string]);
        const totalCount = parseInt(countRows[0].count);

        const { rows: transactions } = await pool.query(
            `SELECT transaction_id as "transactionId", type, amount, description, timestamp 
             FROM transaction_history 
             WHERE account_id = $1 
             ORDER BY timestamp DESC
             LIMIT $2 OFFSET $3`,
            [accountId as string, pageSize, offset]
        );

        const formattedTransactions = transactions.map(t => ({
            ...t,
            amount: Number(t.amount)
        }));

        res.status(200).json({
            currentPage: page,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
            totalCount,
            items: formattedTransactions
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:accountId/events', async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;

        const events = await eventStore.getEventsForAggregate(accountId as string);

        if (events.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const mappedEvents = events.map(e => ({
            eventId: e.eventId,
            eventType: e.eventType,
            eventNumber: e.eventNumber,
            data: e.data,
            timestamp: e.timestamp
        }));

        res.status(200).json(mappedEvents);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:accountId/balance-at/:timestamp', async (req: Request, res: Response) => {
    try {
        const { accountId, timestamp } = req.params;
        const targetTime = new Date(timestamp as string);

        if (isNaN(targetTime.getTime())) {
            return res.status(400).json({ error: 'Invalid timestamp format' });
        }

        const allEvents = await eventStore.getEventsForAggregate(accountId as string);
        if (allEvents.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Filter events up to the target timestamp
        const pastEvents = allEvents.filter(e => new Date(e.timestamp) <= targetTime);

        // Replay history to find the balance
        const account = new BankAccount(accountId as string);

        try {
            account.loadFromHistory(pastEvents);
        } catch (e) {
            // Ignore business validation errors during replay
        }

        res.status(200).json({
            accountId,
            balanceAt: account.balance,
            timestamp: targetTime.toISOString()
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
