import { Expose, Exclude } from 'class-transformer';

@Exclude()
export class UserProfileDto {
  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  phoneNumber: string;

  @Expose()
  profilePictureUrl: string;

  @Expose()
  createdAt: Date;
}
