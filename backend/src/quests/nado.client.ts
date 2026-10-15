import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Address, Hex } from 'viem';
import type { Env } from '../config/env';
import { NADO_SUBACCOUNT_NAMES, nadoSubaccount } from './nado';

// One UTC day of Nado's portfolio calendar (archive POST
// { portfolio_calendar }). Amounts are plain decimal strings in USDT0.
type CalendarDay = { date: string; volume: string; trade_count: string };

type Calendar = { spot?: CalendarDay[]; perp?: CalendarDay[] };

const DAY_S = 86_400;

const utcMidnight = (date: Date) =>
  Math.floor(date.getTime() / 1000 / DAY_S) * DAY_S;

@Injectable()
export class NadoClient {
  private readonly archiveUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.archiveUrl = config.get('NADO_ARCHIVE_URL', { infer: true });
  }

  // USD volume the wallet traded on perps (futures) from the UTC day of
  // `from` through the UTC day of `to`, across all its subaccounts. Day
  // granular, and today's figure can lag up to ~20 minutes behind trades.
  async perpVolume(wallet: Address, from: Date, to: Date) {
    const totals = await Promise.all(
      NADO_SUBACCOUNT_NAMES.map(async (name) => {
        const calendar = await this.calendar(
          nadoSubaccount(wallet, name),
          utcMidnight(from),
          utcMidnight(to),
        );
        return (calendar.perp ?? []).reduce(
          (sum, day) => sum + Number(day.volume),
          0,
        );
      }),
    );
    return totals.reduce((a, b) => a + b, 0);
  }

  // A subaccount that never traded answers with empty lists.
  private async calendar(subaccount: Hex, startTime: number, endTime: number) {
    const res = await fetch(this.archiveUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        portfolio_calendar: {
          subaccount,
          start_time: startTime,
          end_time: endTime,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Nado API responded with ${res.status}`);
    return (await res.json()) as Calendar;
  }
}
