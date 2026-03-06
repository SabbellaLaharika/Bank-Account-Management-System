import { BaseEvent } from '../domain/events/BaseEvent';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/connection';
import { Projector } from './Projector';

export class EventStore {
  private projector = new Projector();

  async saveEvents(aggregateId: string, aggregateType: string, events: BaseEvent[], expectedVersion: number): Promise<void> {
    if (events.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Optimistic concurrency check
      const { rows: versionRows } = await client.query(
        'SELECT MAX(event_number) as current_version FROM events WHERE aggregate_id = $1',
        [aggregateId]
      );

      const currentVersion = versionRows[0].current_version || 0;

      if (currentVersion !== expectedVersion) {
        throw new Error(`ConcurrencyException: Expected version ${expectedVersion} but found ${currentVersion}`);
      }

      for (const event of events) {
        await client.query(
          `INSERT INTO events (event_id, aggregate_id, aggregate_type, event_type, event_data, event_number, version) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            event.eventId,
            event.aggregateId,
            aggregateType,
            event.eventType,
            JSON.stringify(event.data),
            event.eventNumber,
            event.version
          ]
        );
      }

      await client.query('COMMIT');

      // Snapshotting Logic
      const newVersion = currentVersion + events.length;
      if (Math.floor(currentVersion / 50) < Math.floor(newVersion / 50)) {
        await this.createSnapshot(aggregateId, aggregateType);
      }

      // Asynchronous projection update (could be handled via a message queue in production)
      for (const event of events) {
        this.projector.processEvent(event as any).catch(err => {
          console.error(`Failed to project event ${event.eventId}:`, err);
        });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEventsForAggregate(aggregateId: string): Promise<BaseEvent[]> {
    // 1. Try to load latest snapshot
    const { rows: snapshotRows } = await pool.query(
      'SELECT snapshot_data, last_event_number FROM snapshots WHERE aggregate_id = $1',
      [aggregateId]
    );

    let startVersion = 0;
    let events: BaseEvent[] = [];

    // Inject a special "SnapshotLoaded" event if snapshot exists so the aggregate can hydrate
    if (snapshotRows.length > 0) {
      const snapshot = snapshotRows[0];
      startVersion = snapshot.last_event_number;
      events.push({
        eventId: uuidv4(),
        aggregateId,
        aggregateType: 'BankAccount', // Hardcoded as this system only has BankAccounts
        eventType: 'SnapshotLoaded',
        eventNumber: startVersion,
        timestamp: new Date().toISOString(),
        version: 1,
        data: snapshot.snapshot_data
      });
    }

    const { rows } = await pool.query(
      'SELECT * FROM events WHERE aggregate_id = $1 AND event_number > $2 ORDER BY event_number ASC',
      [aggregateId, startVersion]
    );

    const newEvents = rows.map(row => ({
      eventId: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: row.event_data,
      eventNumber: row.event_number,
      timestamp: row.timestamp,
      version: row.version
    }));

    return [...events, ...newEvents];
  }

  private async createSnapshot(aggregateId: string, aggregateType: string): Promise<void> {
    // Rebuild state from all events to get the current state
    const { rows } = await pool.query('SELECT * FROM events WHERE aggregate_id = $1 ORDER BY event_number ASC', [aggregateId]);

    if (rows.length === 0) return;

    const events: BaseEvent[] = rows.map(row => ({
      eventId: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: row.event_data,
      eventNumber: row.event_number,
      timestamp: row.timestamp,
      version: row.version
    }));

    // A cleaner way in production is injecting the aggregate factory here
    // For this project, we know we're dealing with BankAccount
    const { BankAccount } = require('../domain/BankAccount');
    const account = new BankAccount(aggregateId);
    account.loadFromHistory(events);

    const snapshotData = {
      ownerName: account.ownerName,
      balance: account.balance,
      currency: account.currency,
      status: account.status
    };

    await pool.query(
      `INSERT INTO snapshots (snapshot_id, aggregate_id, snapshot_data, last_event_number) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (aggregate_id) DO UPDATE 
           SET snapshot_data = EXCLUDED.snapshot_data, last_event_number = EXCLUDED.last_event_number, created_at = NOW()`,
      [uuidv4(), aggregateId, snapshotData, account.version]
    );
  }
}
