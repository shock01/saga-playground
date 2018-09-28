
/**
 * complete
 * during
 * 
 */

/**
 * value objects
 */
export class EventDate {
    constructor(public readonly date: string) {

    }

    toDate(): Date {
        return new Date(this.date);
    }
}

export class State {
    constructor(public readonly state: string,
        public readonly date: Date = new Date()) {
    }

    toDate(): Date {
        return new Date(this.date);
    }
}

export default class Saga<T> {

    private lastEventDate_: EventDate;
    private currentState_: State;

    constructor(public readonly referenceId: string) {

    }

    withLastEventDate(date: string): Saga<T> {
        this.lastEventDate_ = new EventDate(date);
        return this;
    }

    lastEventDate(): EventDate {
        return this.lastEventDate_;
    }

    withCurrentState(state: string): Saga<T> {
        this.currentState_ = new State(state);
        return this;
    }

    currentState(): State {
        return this.currentState_;
    }
}