import { Expose, Exclude } from 'class-transformer';
import { Point } from 'geojson';

@Exclude()
export class UserProfileDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email?: string;

  @Expose()
  phoneNumber?: string;

  @Expose()
  profilePictureUrl: string;

  @Expose()
  currentLocation: Point;

  @Expose()
  createdAt: Date;
}
