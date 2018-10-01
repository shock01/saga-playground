import * as logger from "winston";
import { STATUS_CODES } from "http";
import { EventEmitter } from "events";

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
    <T>(saga: T, event?: Event<any>): T | Promise<T> | void;
}

export interface ThenSupplier<T> {
    <T>(saga: T, event?: Event<any>): T | Promise<T> | void;
}

export interface Supplier<T> {
    <T>(saga: T): T | Promise<T> | void;
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

export interface SagaEventListener {
    handleEvent<T>(event: Event<T>): void;
}

export class SagaState<T> implements SagaEventListener {

    protected events: Map<string, StateEvent<T>>;

    constructor(private sagaProcess: SagaProcess<T>) {

    }

    /**
     * 
     * handles event at a given state
     * will pass payload as copy of previous payload
     * to make payloads immutable
     * @param {Event<any>}event 
     */
    async handleEvent(event: Event<any>) {
        if (!this.events.has(event.eventType)) {
            return;
        }
        let { payload } = this.sagaProcess;
        const { thenables } = this.events.get(event.eventType);

        for (let thenable of thenables) {
            await thenable(payload, event);
        }
    }

    static Builder = <T>(sagaProcess: SagaProcess<T>) => {
        const state = new SagaState(sagaProcess);
        const builder = {
            withEvents: (events: Map<string, StateEvent<T>>) => {
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
/**
 * dispatches
 *  - onend
 *  - ontransition
 * 
 */

export class SagaProcess<T> extends EventEmitter, implements SagaEventListener {

    private duringStates: Set<string> = new Set();
    private transitions: Map<string, string> = new Map();
    private stateEvents: Map<string, Map<string, StateEvent<T>>> = new Map();

    constructor(private initialState: string,
        private currentState: string = initialState,
        public payload: T = <any>{}) {
        super();
        this.duringStates.add(initialState);
    }

    /**
     * returns the initial state the sage will start with
     */
    get startsAt() {
        return this.initialState;
    }

    /**
     * returns the currentState
     */
    get isAt() {
        return this.currentState;
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
                .withEvents(this.eventsForState(state))
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
    eventTypesForState(state: string): string[] {
        if (!this.stateEvents.has(state)) {
            return [];
        }
        return Array.from(this.stateEvents.get(state).keys());
    }

    /**
 * 
 * @param {string} state 
 * @returns list of events for the given state
 */
    eventsForState(state: string): Map<string, StateEvent<T>> {
        if (!this.stateEvents.has(state)) {
            return new Map();
        }
        return this.stateEvents.get(state);
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
        logger.debug(`[when] state:${state}, eventType:${eventType}`);
        let stateEvents = new Map<string, StateEvent<T>>();

        if (this.stateEvents.has(state)) {
            stateEvents = this.stateEvents.get(state);
        }
        if (stateEvents.has(eventType)) {
            return this;
        }
        stateEvents.set(eventType, {
            eventType,
            supplier,
            thenables: []
        });
        this.stateEvents.set(state, stateEvents);
        return this;
    }

    then(state: string, eventType: string, supplier: ThenSupplier<T>): SagaProcess<T> {
        logger.debug(`[then] state:${state}, eventType:${eventType}`);
        const stateEvents = this.stateEvents.get(state);
        if (!stateEvents) {
            logger.warn(`[then] missing stateEvents for state: ${state}`)
            return this;
        }
        const stateEvent = stateEvents.get(eventType);
        if (!stateEvent) {
            logger.warn(`[then] missing eventType: ${eventType} for state: ${state}`);
            return this;
        }
        stateEvent.thenables.push(supplier);
        return this;
    }

    next(from: string, to: string) {
        logger.debug(`[next] adding transition from: ${from}, to: ${to}`);
        this.transitions.set(from, to);
    }

    /**
     * convenience method that wraps thenable 
     * to dispose the saga process
     * 
     * @param {string} state
     * @param {string} event 
     */
    complete(state: string, event: string) {
        logger.debug(`[complete] adding complete handler for state: ${state} and event: ${event}`)
        this.next(state, undefined);
        return this.then(state, event, () => this.dispose());
    }

    async handleEvent(event: Event<any>) {
        const stateEvents = this.stateEvents.get(this.currentState);

        if (!stateEvents) {
            return;
        }
        const stateEvent = stateEvents.get(event.eventType);

        if (!stateEvent) {
            return;
        }
        if (typeof stateEvent.supplier === 'function') {
            await stateEvent.supplier(this.payload, event);
        }

        let state = this.state(this.currentState);

        if (state) {
            await state.handleEvent(event);
        }
        this.transition();
    }

    private dispose() {
        this.emit('end');
    }

    private transition() {
        const from = this.currentState;
        if (!this.transitions.has(from)) {
            logger.warn(`[transition] transition from: ${from} is unknown`);
            return;
        }
        const to = this.transitions.get(from);
        logger.debug(`[transition] transition from: ${from} to: ${to}`);
        this.emit('transition', { from, to });
        this.currentState = to;
    }
}

const withSaga = <T>(sagaProcess: SagaProcess<T>, state: string = null, event: string = null) => {
    return {
        next: (next: string) => {
            sagaProcess.next(state, next);
            return {
                during: (state: string) => withSaga(sagaProcess.during(state), state, event)
            };
        },
        when: (event: string, supplier: WhenSupplier<T>) => withSaga(sagaProcess.when(state, event, supplier), state, event),
        then: (supplier: ThenSupplier<T>) => withSaga(sagaProcess.then(state, event, supplier), state, event),
        complete: () => withSaga(sagaProcess.complete(state, event), state, event),
        build: () => sagaProcess
    };
};

export function builder<T>(initialState: string): ProcessEvent<T> {
    return {
        when: (event: string, supplier: WhenSupplier<T>) => withSaga<T>(new SagaProcess(initialState), initialState).when(event, supplier)
    };
};