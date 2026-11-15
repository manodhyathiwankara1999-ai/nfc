import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard';
import { WriteRateLimitGuard } from '../../common/guards/write-rate-limit.guard';
import { CardWorkspaceService } from './card-workspace.service';
import { CardUploadsService } from './card-uploads.service';

@Module({
  controllers: [CardsController],
  providers: [
    CardsService,
    CardWorkspaceService,
    CardUploadsService,
    AuthOriginGuard,
    WriteRateLimitGuard,
  ],
  exports: [CardWorkspaceService],
})
export class CardsModule {}
