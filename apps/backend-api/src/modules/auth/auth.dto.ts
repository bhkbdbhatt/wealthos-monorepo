import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { type UserDto } from '@wealthos/shared-types';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(96)
  password!: string;
}

export class ClientRegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(96)
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName!: string;

  /** Digits only, 10 chars for Indian mobiles. */
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a 10-digit Indian mobile' })
  phone?: string;

  /** Optional advisor routing via partner username (white-label acquisition). */
  @IsOptional()
  @IsString()
  ownerAdvisorUsername?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

/** Application-layer input for CLIENT self-registration (phone is optional). */
export interface RegisterClientInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  ownerAdvisorUsername?: string | null;
}

export interface AuthSessionDto {
  user: UserDto;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  };
}
