// src/modules/pricing/entities/pricing-settings.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Check,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

export enum PricingScopeType {
  GLOBAL = 'global',
  CITY = 'city',
  ZONE = 'zone',
}

export enum SurgeMode {
  OFF = 'off', // multiplicador = 1.0
  OVERRIDE = 'override', // multiplicador fijo surge_override
  SCHEDULE = 'schedule', // multiplicador según schedule_rules
}

@Entity({ name: 'pricing_settings' })
@Index('idx_pricing_scope', ['scopeType', 'scopeRef'])
@Index('idx_pricing_service_class', ['serviceClass'])
@Index('idx_pricing_active_updated', ['isActive', 'updatedAt'])
@Check(`(currency IS NULL) OR (char_length(currency) = 3)`)
@Check(`base_fare >= 0`)
@Check(`per_km >= 0`)
@Check(`per_min >= 0`)
@Check(`booking_fee >= 0`)
@Check(`min_fare >= 0`)
@Check(`free_km >= 0`)
@Check(`free_min >= 0`)
@Check(`surge_cap IS NULL OR surge_cap >= 1.0`)
@Check(`
  surge_mode <> 'override' OR surge_override IS NOT NULL
`)
export class PricingSettings {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  /** Dónde aplica esta fila: global | city | zone */
  @Column({
    type: 'enum',
    enum: PricingScopeType,
    enumName: 'pricing_scope_type',
    name: 'scope_type',
  })
  scopeType: PricingScopeType;

  /**
   * Referencia al ámbito:
   * - city  -> city_code (string)
   * - zone  -> zone_id (uuid en texto o uuid nativo)
   * - global-> NULL
   */
  @Column('text', { name: 'scope_ref', nullable: true })
  scopeRef?: string | null;

  /** Clase de servicio (coincide con la del vehículo del trip) */
  @Column('text', { name: 'service_class' })
  serviceClass: string;

  /** Moneda ISO-4217 (ej. USD, EUR). Opcional si tu sistema define moneda global. */
  @Column('char', { name: 'currency', length: 3, nullable: true })
  currency?: string | null;

  /** Componentes base del cálculo */
  @Column('numeric', { name: 'base_fare', precision: 10, scale: 2, default: 0 })
  baseFare: string;

  @Column('numeric', { name: 'per_km', precision: 10, scale: 4, default: 0 })
  perKm: string;

  @Column('numeric', { name: 'per_min', precision: 10, scale: 4, default: 0 })
  perMin: string;

  @Column('numeric', {
    name: 'booking_fee',
    precision: 10,
    scale: 2,
    default: 0,
  })
  bookingFee: string;

  @Column('numeric', { name: 'min_fare', precision: 10, scale: 2, default: 0 })
  minFare: string;

  @Column('numeric', { name: 'free_km', precision: 10, scale: 3, default: 0 })
  freeKm: string;

  @Column('numeric', { name: 'free_min', precision: 10, scale: 2, default: 0 })
  freeMin: string;

  /** Configuración de surge */
  @Column({
    type: 'enum',
    enum: SurgeMode,
    enumName: 'pricing_surge_mode',
    name: 'surge_mode',
    default: SurgeMode.OFF,
  })
  surgeMode: SurgeMode;

  /** Multiplicador fijo cuando surgeMode=OVERRIDE (ej. 1.25) */
  @Column('numeric', {
    name: 'surge_override',
    precision: 6,
    scale: 3,
    nullable: true,
  })
  surgeOverride?: string | null;

  /** Límite superior del multiplicador (seguridad) */
  @Column('numeric', {
    name: 'surge_cap',
    precision: 6,
    scale: 3,
    nullable: true,
  })
  surgeCap?: string | null;

  /**
   * Reglas horarias simples si surgeMode=SCHEDULE.
   * Ejemplo:
   * [
   *   { "dow":[1,2,3,4,5], "start":"07:00", "end":"09:00", "mult":1.20 },
   *   { "dow":[5,6], "start":"22:00", "end":"23:59", "mult":1.30 }
   * ]
   */
  @Column('jsonb', { name: 'schedule_rules', nullable: true })
  scheduleRules?: Array<{
    dow: number[]; // 0..6
    start: string; // "HH:mm"
    end: string; // "HH:mm"
    mult: number; // e.g. 1.25
  }> | null;

  /** Habilita/deshabilita esta config */
  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  /** Auditoría */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
