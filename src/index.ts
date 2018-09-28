export * from './infrastructure/repository';
export * from './application/process';

/**
 * 
 * whenever a saga process will handle an event it should mark the date of last event
 * to prevent multiple process to run the same saga.
 * 
 * 
 * process.define(() => initially(when().then().complete()))
 * 
 * initially -> the start event
 *  -> can call then() to initiate an action
 *  -> can call complete to mark the saga / process as complete
 *  -> can call transitionTo to move the saga to a new event it will wait for
 * 
 * when -> called after the start event and is the next event to listen to
 * 
 * where to store like a timeout of the saga .....
 * process.define({max_ttl}, (spec) => {
 *  return spec
 *      .context('new order').
 *         .when(event)
 *  *      .then((saga) => do something) // action
 *         .next('preps);
 *      
 *      .describe('preps')
 *          .when('event')
    *          .then(() => ) -> do something dispatch actions
    *          .then(() => ) => multiple actions will/may be dispatched
    *          .next('prepared') -> the state it waits for 
 * 
 *      .describe('prepared')
    *          .when('drink prepared])
    *          .done()
 * })
 * 
 * 
 */