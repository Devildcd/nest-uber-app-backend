import { TransactionsRepository } from './transactions.repository';

describe('TransactionsRepository', () => {
  it('should be defined', () => {
    expect(new TransactionsRepository()).toBeDefined();
  });
});
