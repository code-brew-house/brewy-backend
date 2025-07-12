import { UserResponseDto } from '../../user/dto/user-response.dto';

/**
 * DTO for consistent authentication response format
 */
export class AuthResponseDto {
  /** Success status */
  success: boolean;

  /** Response message */
  message: string;

  /** Response data containing user, organization, and token */
  data: {
    user: UserResponseDto;
    organization?: {
      id: string;
      name: string;
      role: string;
    };
    token: string;
    tokenType?: string;
    expiresIn?: number;
  };

  constructor(
    message: string,
    user: UserResponseDto,
    token: string,
    expiresIn?: number,
    organization?: {
      id: string;
      name: string;
      role: string;
    },
  ) {
    this.success = true;
    this.message = message;
    this.data = {
      user,
      organization,
      token,
      tokenType: 'Bearer',
      expiresIn,
    };
  }
}
