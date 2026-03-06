import { BaseEvent } from '../domain/events/BaseEvent';
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
    const { rows } = await pool.query(
      'SELECT * FROM events WHERE aggregate_id = $1 ORDER BY event_number ASC',
      [aggregateId]
    );

    return rows.map(row => ({
      eventId: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: row.event_data,
      eventNumber: row.event_number,
      timestamp: row.timestamp,
      version: row.version
    }));
  }
}
