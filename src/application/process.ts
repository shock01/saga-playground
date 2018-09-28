import Saga from "../domain/saga";
import * as logger from "winston";


logger.configure({
    level: process.env.LOG_LEVEL_SAGA_PROCESS || 'debug',
    transports: [
        new logger.transports.Console({})
    ]
});

export interface Event<T> {
    readonly eventId: string;
    readonly eventType: string;
    readonly date: string;
    readonly version: string;
    readonly payload: T;
}

export interface WhenSupplier<T> {
    <T>(saga: Saga<T>, event?: Event<any>): T | Promise<T> | void;
}

export interface ThenSupplier<T> {
    <T>(saga: Saga<T>, event?: Event<any>): T | Promise<T> | void;
}

export interface Supplier<T> {
    <T>(saga: Saga<T>): T | Promise<T> | void;
}

export interface ProcessAction<T> extends ProcessEvent<T> {
    next(state: string): ProcessState<T>;
    then(supplier: ThenSupplier<T>): ProcessAction<T>;
    complete(): ProcessAction<T>;
    build(): SagaProcess<T>;
}

export interface ProcessEvent<T> {
    when(state: string, supplier: WhenSupplier<T>): ProcessAction<T>;
}

export interface ProcessState<T> {
    during(state: string): ProcessEvent<T>;
}

export interface Process {
    handleEvent<T>(event: Event<T>): void;
}
export class SagaProcess<T> {

    private duringStates: Set<string> = new Set();
    private stateEvents: Map<string, Set<string>> = new Map();

    constructor(private initialState: string) {

    }

    /**
     * returns the initial state the sage will start with
     */
    get startsAt() {
        return this.initialState;
    }

    /**
     * returns a list of states it may transition to
     */
    get states(): string[] {
        return Array.from(this.duringStates);
    }

    get events(): string[] {
        let events = new Set<string>();
        for (let values of this.stateEvents.values()) {
            for (let value of values) {
                events.add(value);
            }
        }
        return Array.from(events);
    }

    /**
     * 
     * @param {string} state 
     * @returns list of events for the given state
     */
    eventsForState(state: string): string[] {
        if (!this.stateEvents.has(state)) {
            return [];
        }
        return Array.from(this.stateEvents.get(state));
    }

    /**
     * 
     * @param {string} state 
     * returns SagaProcess
     */
    during(state: string): SagaProcess<T> {
        this.duringStates.add(state);
        return this;
    }

    /**
     * 
     * @param {string} state the state to which the event applies to
     * @param {string} event 
     * @param {Supplier<T>?} supplier supplier to be called when event is triggered
     */
    when(state: string, event: string, supplier?: WhenSupplier<T>): SagaProcess<T> {
        let events = new Set<string>();
        if (this.stateEvents.has(state)) {
            events = this.stateEvents.get(state);
        }
        events.add(event);
        logger.debug(`[SageProcess.when] adding: ${event} for state: ${state}, values: ${Array.from(events)}`);
        this.stateEvents.set(state, events);
        return this;
    }

}

const withSaga = <T>(sagaProcess: SagaProcess<T>, state: string = null, event: string = null) => {
    return {
        next: (state: string) => {
            return {
                during: (state: string) => withSaga(sagaProcess.during(state), state, event)
            };
        },
        then: (supplier: ThenSupplier<T>) => withSaga(sagaProcess, state, event),
        complete: () => withSaga(sagaProcess, state, event),
        when: (event: string, supplier: WhenSupplier<T>) => withSaga(sagaProcess.when(state, event, supplier), state, event),
        build: () => sagaProcess
    };
};

export function builder<T>(initialState: string): ProcessEvent<T> {
    return {
        when: (event: string, supplier: WhenSupplier<T>) => withSaga<T>(new SagaProcess(initialState))
    };
};