import { AggregateRoot } from './AggregateRoot';
import {
    AccountCreated,
    AccountClosed,
    MoneyDeposited,
    MoneyWithdrawn
} from './events/BankAccountEvents';

import { v4 as uuidv4 } from 'uuid';

export class BankAccount extends AggregateRoot {
    public ownerName!: string;
    public balance: number = 0;
    public currency!: string;
    public status: 'OPEN' | 'CLOSED' = 'OPEN';
    private processedTransactions: Set<string> = new Set();

    constructor(id: string) {
        super(id);
    }

    // --- Command Methods ---

    public create(ownerName: string, initialBalance: number, currency: string): void {
        if (this.version > 0) {
            throw new Error('Account already exists');
        }

        if (initialBalance < 0) {
            throw new Error('Initial balance cannot be negative');
        }

        this.applyChange({
            eventId: uuidv4(),
            aggregateId: this.id,
            aggregateType: 'BankAccount',
            eventType: 'AccountCreated',
            eventNumber: this.version + 1,
            timestamp: new Date().toISOString(),
            version: 1, // Schema says version defaults to 1 per event insertion format, eventNumber track aggregate version.
            data: {
                ownerName,
                initialBalance,
                currency
            }
        } as AccountCreated);
    }

    public deposit(amount: number, description: string, transactionId: string): void {
        if (this.status === 'CLOSED') {
            throw new Error('Cannot deposit to a closed account');
        }
        if (amount <= 0) {
            throw new Error('Deposit amount must be positive');
        }

        // Idempotency check
        if (this.processedTransactions.has(transactionId)) {
            return;
        }

        this.applyChange({
            eventId: uuidv4(),
            aggregateId: this.id,
            aggregateType: 'BankAccount',
            eventType: 'MoneyDeposited',
            eventNumber: this.version + 1,
            timestamp: new Date().toISOString(),
            version: 1,
            data: {
                amount,
                description,
                transactionId
            }
        } as MoneyDeposited);
    }

    public withdraw(amount: number, description: string, transactionId: string): void {
        if (this.status === 'CLOSED') {
            throw new Error('Cannot withdraw from a closed account');
        }
        if (amount <= 0) {
            throw new Error('Withdrawal amount must be positive');
        }

        // Idempotency check
        if (this.processedTransactions.has(transactionId)) {
            return;
        }

        if (this.balance - amount < 0) {
            throw new Error('Insufficient funds');
        }

        this.applyChange({
            eventId: uuidv4(),
            aggregateId: this.id,
            aggregateType: 'BankAccount',
            eventType: 'MoneyWithdrawn',
            eventNumber: this.version + 1,
            timestamp: new Date().toISOString(),
            version: 1,
            data: {
                amount,
                description,
                transactionId
            }
        } as MoneyWithdrawn);
    }

    public close(reason: string): void {
        if (this.status === 'CLOSED') {
            throw new Error('Account is already closed');
        }

        if (this.balance !== 0) {
            throw new Error('Account balance must be zero to close');
        }

        this.applyChange({
            eventId: uuidv4(),
            aggregateId: this.id,
            aggregateType: 'BankAccount',
            eventType: 'AccountClosed',
            eventNumber: this.version + 1,
            timestamp: new Date().toISOString(),
            version: 1,
            data: {
                reason
            }
        } as AccountClosed);
    }

    // --- Apply Methods (State Mutators) ---

    protected applyAccountCreated(event: AccountCreated): void {
        this.ownerName = event.data.ownerName;
        this.currency = event.data.currency;
        this.status = 'OPEN';
        // Initial balance usually comes via a deposit event right after creation,
        // but the task requirements specifies it's passed here.
        if (event.data.initialBalance > 0) {
            this.balance = event.data.initialBalance;
        } else {
            this.balance = 0;
        }
    }

    protected applyMoneyDeposited(event: MoneyDeposited): void {
        this.balance += event.data.amount;
        this.processedTransactions.add(event.data.transactionId);
    }

    protected applyMoneyWithdrawn(event: MoneyWithdrawn): void {
        this.balance -= event.data.amount;
        this.processedTransactions.add(event.data.transactionId);
    }

    protected applyAccountClosed(event: AccountClosed): void {
        this.status = 'CLOSED';
    }
}
