import { expect } from 'chai';

import { builder, Event, SagaProcess } from './process';

interface SagaPayload { }
interface MyEvent extends Event<any> { }

const instance = () => {
    return builder<SagaPayload>
        ('startState') // duplication of initialState, maybe return 
        .when('myEvent', function (): any {
            return null;
        })
        .next('nextState_1')
        .during('nextState_1')
        .when('nextEvent_1_1', (saga, event: MyEvent): any => null)
        .then((saga: SagaPayload, event: MyEvent): void => { saga })
        .then((saga: SagaPayload): void => { saga })
        .when('nextEvent_1_2', (saga, event): any => null)
        .then((saga: SagaPayload): void => { saga })
        .next('nextState_2')
        .during('nextState_2')
        .when('nextEvent_2', (): any => null)
        .complete()
        .build();
};

describe('saga process test', () => {

    context('builder', () => {
        it('should not throw on builder api', () => expect((() => instance())()).not.to.throw);
    });
    context('saga', () => {
        let saga: SagaProcess<SagaPayload>;
        before(() => saga = instance());

        it('should start at: "startState"',
            () => expect(saga.startsAt).to.eql('startState'));

        it('should have nextState_1 and nextState_2',
            () => expect(saga.states).to.eql(['nextState_1', 'nextState_2']));

        it('should return all events it knows about',
            () => expect(saga.events).to.eql(['nextEvent_1_1', 'nextEvent_1_2', 'nextEvent_2']));

        it('should return nextEvent_1_1 and nextEvent_1_2 for nextState_1',
            () => expect(saga.eventsForState('nextState_1')).to.eql(['nextEvent_1_1', 'nextEvent_1_2']));

        context('sage state', () => {

            it('should return null for unknown state of a saga',
                () => expect(saga.state('nextState_1_unknown')).to.be.null);

            it('should return not null for knonwn state of a saga',
                () => expect(saga.state('nextState_1')).not.to.be.null);
        });
    });

});