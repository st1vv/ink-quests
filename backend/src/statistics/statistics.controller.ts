import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isAddress } from 'viem';
import { normalizePostUrl } from '../catalog/post-url';
import { SocialPostsService } from '../catalog/social-posts.service';
import { utcDay } from '../quests/period';
import { AdminGuard } from './admin.guard';
import {
  STATS_VIEWS,
  StatisticsService,
  type StatsView,
} from './statistics.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Controller('statistics')
@UseGuards(AdminGuard)
export class StatisticsController {
  constructor(
    private readonly statistics: StatisticsService,
    private readonly posts: SocialPostsService,
  ) {}

  // { users, usersWithXp, questsCompleted, dailyQuestsCompleted,
  //   partnerQuestsCompleted, checkIns, transactions, transactionUsers }
  @Get()
  stats() {
    return this.statistics.stats();
  }

  // Declared before :view, which would otherwise take "social-posts".
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

  // The list behind a stat card (see STATS_VIEWS), e.g. /statistics/users:
  // { total, page, pageSize, items }. Item fields depend on the list.
  @Get(':view')
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
}
