import { DataSource } from 'typeorm';
import { CashCollectionRecordRepository } from './cash_colletion_records.repository';

describe('CashColletionRecordsRepository', () => {
  it('should be defined', () => {
    expect(new CashCollectionRecordRepository()).toBeDefined();
  });
});
