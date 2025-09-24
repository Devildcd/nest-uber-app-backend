import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { PricingSettings } from '../entities/pricing-settings.entity';

@Injectable()
export class PricingSettingsRepository extends BaseRepository<PricingSettings> {
  constructor(ds: DataSource) {
    super(
      PricingSettings,
      ds.createEntityManager(),
      'PricingSettingsRepository',
      'PricingSettings',
    );
  }

  async findActiveByScope(
    serviceClass: string,
    scope: { type: 'zone' | 'city' | 'global'; ref?: string },
  ): Promise<PricingSettings | null> {
    try {
      if (scope.type === 'global') {
        return await this.findOne({
          where: { serviceClass, scopeType: 'global', isActive: true } as any,
        });
      }
      if (scope.type === 'city') {
        return await this.findOne({
          where: {
            serviceClass,
            scopeType: 'city',
            scopeRef: scope.ref!,
            isActive: true,
          } as any,
        });
      }
      // zone
      return await this.findOne({
        where: {
          serviceClass,
          scopeType: 'zone',
          scopeRef: scope.ref!,
          isActive: true,
        } as any,
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findActiveByScope',
        this.entityName,
      );
    }
  }
}
