import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Hex } from 'viem';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.service';
import { ProgressService } from './progress.service';

@Controller('me')
@UseGuards(AuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  // { totalXp, level, levelXp, nextLevelXp, streak, checkedInToday, week,
  //   checkInXp, fullWeekBonusXp, checkInContract }; levelXp and
  // nextLevelXp are the total XP at which the current and next level start.
  @Get('progress')
  get(@CurrentUser() user: AuthUser) {
    return this.progress.progress(user.id);
  }

  // Once per UTC day; 409 on a repeat. Once CHECKIN_CONTRACT is set, only
  // after paying for it on the contract (422 until that's on chain).
  // Optional { blockNumber, txHash }: the payment just made, its block as a
  // decimal string (the contract is read there) and its transaction hash
  // (kept as a link once checked).
  @Post('check-in')
  @HttpCode(200)
  checkIn(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const { blockNumber, txHash } = (body ?? {}) as {
      blockNumber?: unknown;
      txHash?: unknown;
    };
    if (
      blockNumber !== undefined &&
      !(typeof blockNumber === 'string' && /^\d{1,19}$/.test(blockNumber))
    ) {
      throw new BadRequestException('blockNumber must be a decimal string');
    }
    if (
      txHash !== undefined &&
      !(typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash))
    ) {
      throw new BadRequestException('txHash must be a transaction hash');
    }
    return this.progress.checkIn(user, {
      block: blockNumber === undefined ? undefined : BigInt(blockNumber),
      txHash: txHash as Hex | undefined,
    });
  }
}
