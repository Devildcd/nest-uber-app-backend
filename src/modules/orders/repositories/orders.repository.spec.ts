import { OrdersRepository } from './orders.repository';

describe('OrdersRepository', () => {
  it('should be defined', () => {
    expect(new OrdersRepository()).toBeDefined();
  });
});
