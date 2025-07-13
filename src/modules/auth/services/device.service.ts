import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import * as requestIp from 'request-ip';
import * as geoip from 'geoip-lite';
import { SessionType } from 'src/modules/auth/entities/session.entity';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import DeviceDetector = require('device-detector-js');

export interface DeviceInfo {
  os?: string;
  browser?: string;
  model?: string;
  appVersion?: string;
  deviceType?: string;
}

export interface ClientContext {
  ip: string;
  userAgent: string;
  device: DeviceInfo;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
}

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);
  private readonly detector = new DeviceDetector();

  /**
   * Construye el contexto del cliente: IP, UA, dispositivo y ubicación.
   */
  getClientContext(req: Request): ClientContext {
    // 1) IP real

    const ip = requestIp.getClientIp(req) || '0.0.0.0';

    // 2) User-Agent
    const ua = req.headers['user-agent'] || '';

    // 3) Parseo seguro del UA
    let parsed;
    try {
      parsed = this.detector.parse(ua);
    } catch (err) {
      this.logger.warn('Error parsing User-Agent', err);
      parsed = {};
    }

    // 4) Inferencia de ubicación opcional
    let location;
    try {
      const geo = geoip.lookup(ip);
      if (geo) {
        location = {
          latitude: geo.ll[0],

          longitude: geo.ll[1],

          city: geo.city,

          country: geo.country,
        };
      }
    } catch (err) {
      this.logger.warn('Error getting geoip data', err);
    }

    // 5) Devolver contexto
    return {
      ip,
      userAgent: ua,
      device: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        os: parsed.os?.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        browser: parsed.client?.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        model: parsed.device?.model,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        appVersion: parsed.client?.version,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        deviceType: parsed.device?.type,
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      location,
    };
  }

  /**
   * Determina el tipo de sesión por defecto según deviceType.
   */
  inferSessionType(deviceType?: string): SessionType {
    switch (deviceType) {
      case 'smartphone':
      case 'tablet':
        return SessionType.MOBILE_APP;
      case 'desktop':
        return SessionType.WEB;
      default:
        return SessionType.API_CLIENT;
    }
  }
}
