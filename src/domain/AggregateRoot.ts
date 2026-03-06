import { BaseEvent } from './events/BaseEvent';

export abstract class AggregateRoot {
  public id: string;
  public version: number = 0;
  private uncommittedEvents: BaseEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  public getUncommittedEvents(): BaseEvent[] {
    return this.uncommittedEvents;
  }

  public clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }

  public loadFromHistory(events: BaseEvent[]): void {
    for (const event of events) {
      this.applyEvent(event, false);
    }
  }

  protected applyChange(event: BaseEvent): void {
    this.applyEvent(event, true);
  }

  private applyEvent(event: BaseEvent, isNew: boolean): void {
    const handlerMethod = `apply${event.eventType}`;
    if (typeof (this as any)[handlerMethod] === 'function') {
      (this as any)[handlerMethod](event);
    }

    this.version = event.eventNumber;

    if (isNew) {
      this.uncommittedEvents.push(event);
    }
  }
}
