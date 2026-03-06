import { BaseEvent } from './BaseEvent';

export interface AccountCreatedData {
    ownerName: string;
    initialBalance: number;
    currency: string;
}

export interface MoneyDepositedData {
    amount: number;
    description: string;
    transactionId: string;
}

export interface MoneyWithdrawnData {
    amount: number;
    description: string;
    transactionId: string;
}

export interface AccountClosedData {
    reason: string;
}

export type AccountCreated = BaseEvent<AccountCreatedData> & { eventType: 'AccountCreated' };
export type MoneyDeposited = BaseEvent<MoneyDepositedData> & { eventType: 'MoneyDeposited' };
export type MoneyWithdrawn = BaseEvent<MoneyWithdrawnData> & { eventType: 'MoneyWithdrawn' };
export type AccountClosed = BaseEvent<AccountClosedData> & { eventType: 'AccountClosed' };

export type BankAccountEvent = AccountCreated | MoneyDeposited | MoneyWithdrawn | AccountClosed;
