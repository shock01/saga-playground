import Saga from "../domain/saga";

export interface SagaRepository<T> {
    loadAll(): Promise<Saga<T>[]>;
    store(saga: Saga<T>): Promise<void>;
    remove(saga: Saga<T>): Promise<void>;
    loadByEntityId(id: string): Promise<Saga<T>>;
}

