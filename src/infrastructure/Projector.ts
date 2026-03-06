import { pool } from '../db/connection';
import { BankAccountEvent } from '../domain/events/BankAccountEvents';

export class Projector {
    async processEvent(event: BankAccountEvent): Promise<void> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            if (event.eventType === 'AccountCreated') {
                await this.projectAccountCreated(client, event);
            } else if (event.eventType === 'MoneyDeposited' || event.eventType === 'MoneyWithdrawn') {
                await this.projectTransaction(client, event);
            } else if (event.eventType === 'AccountClosed') {
                await this.projectAccountClosed(client, event);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private async projectAccountCreated(client: any, event: any): Promise<void> {
        // Idempotency: skip if version is less than or equal to current version
        const { rows } = await client.query('SELECT version FROM account_summaries WHERE account_id = $1', [event.aggregateId]);
        if (rows.length > 0 && Number(rows[0].version) >= event.eventNumber) {
            return;
        }

        await client.query(
            `INSERT INTO account_summaries (account_id, owner_name, balance, currency, status, version) 
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (account_id) DO UPDATE 
             SET owner_name = EXCLUDED.owner_name, balance = EXCLUDED.balance, currency = EXCLUDED.currency, status = EXCLUDED.status, version = EXCLUDED.version`,
            [event.aggregateId, event.data.ownerName, event.data.initialBalance || 0, event.data.currency, 'OPEN', event.eventNumber]
        );
    }

    private async projectTransaction(client: any, event: any): Promise<void> {
        // Update account balance
        const { rows } = await client.query('SELECT version, balance FROM account_summaries WHERE account_id = $1 FOR UPDATE', [event.aggregateId]);
        if (rows.length === 0) return; // Account doesn't exist in read model yet

        const currentVersion = Number(rows[0].version);
        if (currentVersion >= event.eventNumber) return; // Idempotency check

        let newBalance = Number(rows[0].balance);
        if (event.eventType === 'MoneyDeposited') {
            newBalance += event.data.amount;
        } else if (event.eventType === 'MoneyWithdrawn') {
            newBalance -= event.data.amount;
        }

        await client.query(
            'UPDATE account_summaries SET balance = $1, version = $2 WHERE account_id = $3',
            [newBalance, event.eventNumber, event.aggregateId]
        );

        // Insert into transaction history
        await client.query(
            `INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (transaction_id) DO NOTHING`,
            [
                event.data.transactionId,
                event.aggregateId,
                event.eventType === 'MoneyDeposited' ? 'DEPOSIT' : 'WITHDRAWAL',
                event.data.amount,
                event.data.description,
                event.timestamp
            ]
        );
    }

    private async projectAccountClosed(client: any, event: any): Promise<void> {
        const { rows } = await client.query('SELECT version FROM account_summaries WHERE account_id = $1', [event.aggregateId]);
        if (rows.length === 0) return;

        const currentVersion = Number(rows[0].version);
        if (currentVersion >= event.eventNumber) return;

        await client.query(
            'UPDATE account_summaries SET status = $1, version = $2 WHERE account_id = $3',
            ['CLOSED', event.eventNumber, event.aggregateId]
        );
    }

    async rebuildAll(): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Clear existing projections
            await client.query('TRUNCATE account_summaries, transaction_history RESTART IDENTITY CASCADE');

            // Fetch all events
            const { rows: events } = await client.query('SELECT * FROM events ORDER BY event_number ASC, timestamp ASC');

            for (let row of events) {
                const typedEvent: BankAccountEvent = {
                    eventId: row.event_id,
                    aggregateId: row.aggregate_id,
                    aggregateType: row.aggregate_type,
                    eventType: row.event_type,
                    data: row.event_data,
                    eventNumber: row.event_number,
                    timestamp: row.timestamp,
                    version: row.version
                } as BankAccountEvent;

                if (typedEvent.eventType === 'AccountCreated') {
                    await this.projectAccountCreated(client, typedEvent);
                } else if (typedEvent.eventType === 'MoneyDeposited' || typedEvent.eventType === 'MoneyWithdrawn') {
                    await this.projectTransaction(client, typedEvent);
                } else if (typedEvent.eventType === 'AccountClosed') {
                    await this.projectAccountClosed(client, typedEvent);
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}
