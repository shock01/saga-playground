import { expect, assert } from 'chai';
import { spy } from 'sinon';
import { builder, Event, SagaProcess, SagaState } from './process';

interface SagaPayload { }
interface MyEvent extends Event<any> { }

const whenable_1 = spy((saga: SagaPayload, event: MyEvent) => { });
const thenable_1 = spy((saga: SagaPayload, event: MyEvent) => { });
const thenable_2 = async (saga: SagaPayload, event: MyEvent) => { return Promise.resolve(null) };

const instance = () => {
    return builder<SagaPayload>
        ('startState') // duplication of initialState, maybe return 
        .when('myEvent', whenable_1)
        .next('nextState_1')
        .during('nextState_1')
        .when('nextEvent_1_1', (saga, event: MyEvent): any => null)
        .then(thenable_1)
        .then(thenable_2)
        .when('nextEvent_1_2', (saga, event): any => null)
        .then((saga: SagaPayload): void => { saga })
        .next('nextState_2')
        .during('nextState_2')
        .when('nextEvent_2', (): any => null)
        .complete()
        .build();
};
describe('saga process test', () => {

    beforeEach(() => {
        thenable_1.resetHistory();
        whenable_1.resetHistory();
    });

    context('builder', () => {
        it('should not throw on builder api', () => expect((() => instance())()).not.to.throw);
    });
    context('saga', () => {
        let saga: SagaProcess<SagaPayload>;
        beforeEach(() => {
            saga = instance()
        });

        it('should start at: "startState"',
            () => expect(saga.startsAt).to.eql('startState'));

        it('should be at: "startState"',
            () => expect(saga.isAt).to.eql('startState'));

        it('should have nextState_1 and nextState_2',
            () => expect(saga.states).to.eql(['startState', 'nextState_1', 'nextState_2']));

        it('should return all events it knows about',
            () => expect(saga.events).to.eql(['myEvent', 'nextEvent_1_1', 'nextEvent_1_2', 'nextEvent_2']));

        it('should return nextEvent_1_1 and nextEvent_1_2 for nextState_1',
            () => expect(saga.eventTypesForState('nextState_1')).to.eql(['nextEvent_1_1', 'nextEvent_1_2']));

        it('should call whenable', async () => {
            const event: MyEvent = { eventType: 'myEvent' } as MyEvent;
            await saga.handleEvent(event);
            assert(whenable_1.calledOnceWith(saga.payload, event), `whenable should have been called for event: ${event.eventType}`);
        });
        it('should move to nextState_1', async () => {
            const event: MyEvent = { eventType: 'myEvent' } as MyEvent;
            await saga.handleEvent(event);
            expect(saga.isAt).to.eql('nextState_1');
        });

        context('sage state', () => {

            it('should return null for unknown state of a saga',
                () => expect(saga.state('nextState_1_unknown')).to.be.null);

            it('should return not null for known state of a saga',
                () => expect(saga.state('nextState_1')).not.to.be.null);
        });

        context('saga state event', () => {

            it('should call thenable_1', async () => {
                const event: MyEvent = { eventType: 'nextEvent_1_1' } as MyEvent;
                await saga.state('nextState_1').handleEvent(event);
                assert(thenable_1.calledOnceWith(saga.payload, event), `thenable should have been called for event: ${event.eventType}`);
            });
        });
        context('saga complete', () => {
            let event: MyEvent;
            let saga: SagaProcess<SagaPayload>;
            beforeEach(() => {
                saga = builder<SagaPayload>
                    ('startState') // duplication of initialState, maybe return 
                    .when('nextEvent_2', (): any => null)
                    .complete()
                    .build();

                event = { eventType: 'nextEvent_2' } as MyEvent;
            });
            it('should call set isAt to undefined', async () => {
                await saga.handleEvent(event);
                expect(saga.isAt).to.be.undefined;
            });
            it('should dispatch "transition" event', async () => {
                const listener = spy((event: any) => { });
                saga.on('transition', listener);
                await saga.handleEvent(event);
                assert(listener.calledOnce, 'transition listener not called')
                assert(listener.calledOnceWith({ from: 'startState', to: undefined }), 'transition listener not called with correct arguments');
            });
            it('should dispatch "end" event', async () => {
                const listener = spy(() => { });
                saga.on('end', listener);
                await saga.handleEvent(event);
                assert(listener.calledOnce, 'end listener not called');
            });
        });
    });
});