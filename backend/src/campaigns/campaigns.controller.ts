import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { CampaignsService } from './campaigns.service';

@Controller()
@UseGuards(AuthGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  // { claimed: slug[] }: campaigns whose reward the user already has.
  @Get('me/campaigns')
  async claimed(@CurrentUser() user: AuthUser) {
    return { claimed: await this.campaigns.claimed(user.id) };
  }

  // The campaign's XP, once every task is verified.
  @Post('partners/:slug/claim')
  @HttpCode(200)
  claim(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.campaigns.claim(user.id, slug);
  }
}
