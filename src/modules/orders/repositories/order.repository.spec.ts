import { OrderRepository } from './order.repository';

describe('OrdersRepository', () => {
  it('should be defined', () => {
    expect(new OrderRepository()).toBeDefined();
  });
});
