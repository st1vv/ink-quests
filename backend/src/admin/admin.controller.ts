import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isAddress } from 'viem';
import { CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { normalizePostUrl } from '../catalog/post-url';
import { SocialPostsService } from '../catalog/social-posts.service';
import { utcDay } from '../quests/period';
import { AdminGuard } from './admin.guard';
import {
  STATS_VIEWS,
  StatisticsService,
  type StatsView,
} from './statistics.service';
import { xpGrantBody, XpGrantsService } from './xp-grants.service';

const DAY_MS = 24 * 60 * 60 * 1000;

// Everything behind the admin pages lives under /admin.
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly statistics: StatisticsService,
    private readonly posts: SocialPostsService,
    private readonly xpGrants: XpGrantsService,
  ) {}

  // { users, usersWithXp, questsCompleted, dailyQuestsCompleted,
  //   partnerQuestsCompleted, checkIns, transactions, transactionUsers }
  @Get('stats')
  stats() {
    return this.statistics.stats();
  }

  // { today, posts: { day, postUrl }[] }: the posts of the day from a week
  // ago to two weeks ahead (UTC days).
  @Get('social-posts')
  async socialPosts() {
    const now = Date.now();
    const today = utcDay(new Date(now));
    return {
      today,
      posts: await this.posts.list(
        utcDay(new Date(now - 7 * DAY_MS)),
        utcDay(new Date(now + 14 * DAY_MS)),
      ),
    };
  }

  // { postUrl }: sets the X post of the day for a UTC day (YYYY-MM-DD); an
  // empty postUrl removes it.
  @Put('social-posts/:day')
  async setSocialPost(@Param('day') day: string, @Body() body: unknown) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) {
      throw new BadRequestException('Not a day');
    }
    const raw = (body as { postUrl?: unknown } | null)?.postUrl;
    if (raw !== undefined && raw !== null && typeof raw !== 'string') {
      throw new BadRequestException('postUrl must be a string');
    }
    const postUrl = raw?.trim() ? normalizePostUrl(raw) : null;
    if (raw?.trim() && !postUrl) {
      throw new BadRequestException(
        'Not a post link, expected https://x.com/<handle>/status/<id>',
      );
    }
    await this.posts.set(day, postUrl);
    return { day, postUrl };
  }

  // The latest XP grants, newest first:
  // { id, address, name, points, reason, grantedBy, createdAt }[]
  @Get('xp-grants')
  xpGrantList() {
    return this.xpGrants.recent();
  }

  // { address, points, reason }: gives a user XP (negative takes it away),
  // shown in their activity with the reason.
  @Post('xp-grants')
  grantXp(@CurrentUser() admin: AuthUser, @Body() body: unknown) {
    const input = xpGrantBody.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(
        input.error.issues[0]?.message ?? 'Invalid grant',
      );
    }
    return this.xpGrants.grant(admin.id, input.data);
  }

  // The list behind a stat card (see STATS_VIEWS), e.g. /admin/stats/users:
  // { total, page, pageSize, items }. Item fields depend on the list.
  @Get('stats/:view')
  list(
    @Param('view') view: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('address') address?: string,
  ) {
    if (!STATS_VIEWS.includes(view as StatsView)) {
      throw new NotFoundException();
    }
    if (page < 1) throw new BadRequestException('page must be 1 or more');
    if (address && !isAddress(address, { strict: false })) {
      throw new BadRequestException('Not an address');
    }
    return this.statistics.list(view as StatsView, page, address);
  }

  // Everything a user did, newest first, campaign tasks included:
  // { total, page, pageSize, items: { type, title, partner, points,
  //   bonusPoints, at, txHash, day }[] }
  @Get('users/:address/activity')
  userActivity(
    @Param('address') address: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    if (!isAddress(address, { strict: false })) {
      throw new BadRequestException('Not an address');
    }
    if (page < 1) throw new BadRequestException('page must be 1 or more');
    return this.statistics.userActivity(address, page);
  }
}
