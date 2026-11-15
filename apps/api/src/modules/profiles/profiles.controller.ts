import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProfileUpdateApiSchema, type ProfileUpdateApi } from '@nfc/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@Controller({ path: 'profiles', version: '1' })
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated owner profile' })
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getMine(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the authenticated owner profile' })
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ProfileUpdateApiSchema)) body: ProfileUpdateApi,
  ) {
    return this.profiles.updateMine(user.id, body);
  }
}
