import { Router, Request, Response } from 'express';
import { BankAccount } from '../domain/BankAccount';
import { EventStore } from '../infrastructure/EventStore';

const router = Router();
const eventStore = new EventStore();

router.post('/', async (req: Request, res: Response) => {
    try {
        const { accountId, ownerName, initialBalance, currency } = req.body;

        if (!accountId || !ownerName || initialBalance === undefined || !currency) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const account = new BankAccount(accountId);
        const existingEvents = await eventStore.getEventsForAggregate(accountId);

        if (existingEvents.length > 0) {
            return res.status(409).json({ error: 'Account already exists' });
        }

        account.create(ownerName, initialBalance, currency);
        await eventStore.saveEvents(account.id, 'BankAccount', account.getUncommittedEvents(), 0);

        res.status(202).send();
    } catch (error: any) {
        if (error.message === 'Account already exists' || error.message.includes('Expected version')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
    }
});

router.post('/:accountId/deposit', async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;
        const { amount, description, transactionId } = req.body;

        if (amount === undefined || !transactionId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const events = await eventStore.getEventsForAggregate(accountId as string);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const account = new BankAccount(accountId as string);
        account.loadFromHistory(events);

        account.deposit(amount, description, transactionId);
        await eventStore.saveEvents(account.id, 'BankAccount', account.getUncommittedEvents(), account.version - account.getUncommittedEvents().length);

        res.status(202).send();
    } catch (error: any) {
        if (error.message.includes('closed account') || error.message.includes('Expected version')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
    }
});

router.post('/:accountId/withdraw', async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;
        const { amount, description, transactionId } = req.body;

        if (amount === undefined || !transactionId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const events = await eventStore.getEventsForAggregate(accountId as string);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const account = new BankAccount(accountId as string);
        account.loadFromHistory(events);

        account.withdraw(amount, description, transactionId);
        await eventStore.saveEvents(account.id, 'BankAccount', account.getUncommittedEvents(), account.version - account.getUncommittedEvents().length);

        res.status(202).send();
    } catch (error: any) {
        if (error.message.includes('closed account') || error.message === 'Insufficient funds' || error.message.includes('Expected version')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
    }
});

router.post('/:accountId/close', async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;
        const { reason } = req.body;

        const events = await eventStore.getEventsForAggregate(accountId as string);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const account = new BankAccount(accountId as string);
        account.loadFromHistory(events);

        account.close(reason);
        await eventStore.saveEvents(account.id, 'BankAccount', account.getUncommittedEvents(), account.version - account.getUncommittedEvents().length);

        res.status(202).send();
    } catch (error: any) {
        if (error.message.includes('already closed') || error.message.includes('balance must be zero') || error.message.includes('Expected version')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
    }
});

export default router;
