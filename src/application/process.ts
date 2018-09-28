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


// thenables on events
// next state 
export class SagaState<T> {

    protected events: Set<string> = new Set();

    constructor(private sagaProcess: SagaProcess<T>) {

    }

    static Builder = <T>(sagaProcess: SagaProcess<T>) => {
        const state = new SagaState(sagaProcess);
        const builder = {
            withEvents: (events: Set<string>) => {
                state.events = events;
                return builder;
            },
            build: () => state
        }
        return builder;
    }
}

export interface StateEvent<T> {
    readonly eventType: string;
    readonly supplier: WhenSupplier<T>;
    readonly thenables: ThenSupplier<T>[];
}

export class SagaProcess<T> {

    private duringStates: Set<string> = new Set();
    private stateEvents: Map<string, Map<string, StateEvent<T>>> = new Map();

    /**
     * Map<string, Map<event, StateEvent>
     * 
     * interface StateEvent
     * eventType: string
     * supplier: Supplier
     * thenables: Supplier
     *  
     */

    constructor(private initialState: string,
        public payload: T = <any>{}) {
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

    state(state: string): SagaState<T> {
        if (this.duringStates.has(state)) {
            // return with Builder Pattern
            return SagaState.Builder(this)
                //.withEvents(this.stateEvents.get(state))
                // we need to know the next state to proceed
                // the thenables
                // the complete
                .build();
        }
        return null;
    }

    get events(): string[] {
        let events = new Set<string>();
        for (let values of this.stateEvents.values()) {
            for (let value of values.keys()) {
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
        return Array.from(this.stateEvents.get(state).keys());
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
     * @param {string} eventType 
     * @param {Supplier<T>?} supplier supplier to be called when event is triggered
     */
    when(state: string, eventType: string, supplier?: WhenSupplier<T>): SagaProcess<T> {
        let events = new Map<string, StateEvent<T>>();

        if (this.stateEvents.has(state)) {
            events = this.stateEvents.get(state);
        }
        if (events.has(eventType)) {
            return this;
        }
        events.set(eventType, {
            eventType,
            supplier,
            thenables: []
        });
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