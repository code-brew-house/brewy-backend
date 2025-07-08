import { UserResponseDto } from '../../user/dto/user-response.dto';

/**
 * DTO for consistent authentication response format
 */
export class AuthResponseDto {
  /** Success status */
  success: boolean;

  /** Response message */
  message: string;

  /** Response data containing user and token */
  data: {
    user: UserResponseDto;
    token: string;
    tokenType?: string;
    expiresIn?: number;
  };

  constructor(
    message: string,
    user: UserResponseDto,
    token: string,
    expiresIn?: number,
  ) {
    this.success = true;
    this.message = message;
    this.data = {
      user,
      token,
      tokenType: 'Bearer',
      expiresIn,
    };
  }
}
