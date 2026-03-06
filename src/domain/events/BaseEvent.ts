export interface BaseEvent<TData = any> {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  data: TData;
  eventNumber: number;
  timestamp: string;
  version: number;
}
