import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dto/api-response.dto';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
    intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map((body) => {
                // Si el handler ya devolvió un ApiResponseDto (tiene 'success'), no lo toco
                if (body && typeof body === 'object' && 'success' in body) {
                    return body as ApiResponseDto<any>;
                }
                // En caso normal, lo envuelvo
                return { success: true, message: 'OK', data: body } as ApiResponseDto<any>;
            }),
        );
    }
}