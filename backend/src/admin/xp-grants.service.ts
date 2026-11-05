import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
import type { Database } from '../database/client';
import { DB } from '../database/database.module';
import { users, xpGrants } from '../database/schema';

export const XP_GRANTS_SHOWN = 50;
// A typo guard, not a business rule.
export const MAX_GRANT_XP = 100_000;

// Negative points take XP away, e.g. to undo a grant.
export const xpGrantBody = z.object({
  address: z
    .string()
    .trim()
    .refine((a) => isAddress(a, { strict: false }), 'Not an address'),
  points: z
    .number()
    .int('XP must be a whole number')
    .refine((p) => p !== 0, "XP can't be 0")
    .refine(
      (p) => Math.abs(p) <= MAX_GRANT_XP,
      `At most ${MAX_GRANT_XP} XP at once`,
    ),
  reason: z
    .string()
    .trim()
    .min(1, 'Give a reason, the user sees it')
    .max(100, 'Keep the reason under 100 characters'),
});
export type XpGrantInput = z.infer<typeof xpGrantBody>;

const recipients = alias(users, 'recipients');
const admins = alias(users, 'admins');

// XP given by hand from the admin page; it counts everywhere XP does
// except challenge boards.
@Injectable()
export class XpGrantsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async grant(adminId: number, input: XpGrantInput) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.address, input.address.toLowerCase()));
    // Users exist once they sign in; there's no one to give XP to before.
    if (!user) throw new BadRequestException('No user with this address');

    const [row] = await this.db
      .insert(xpGrants)
      .values({
        userId: user.id,
        points: input.points,
        reason: input.reason,
        grantedById: adminId,
      })
      .returning({ id: xpGrants.id });
    return { id: row.id, ...input, address: getAddress(input.address) };
  }

  // The latest grants, newest first.
  async recent() {
    const rows = await this.db
      .select({
        id: xpGrants.id,
        address: recipients.address,
        name: recipients.displayName,
        points: xpGrants.points,
        reason: xpGrants.reason,
        grantedBy: admins.address,
        createdAt: xpGrants.createdAt,
      })
      .from(xpGrants)
      .innerJoin(recipients, eq(recipients.id, xpGrants.userId))
      .leftJoin(admins, eq(admins.id, xpGrants.grantedById))
      .orderBy(desc(xpGrants.createdAt), desc(xpGrants.id))
      .limit(XP_GRANTS_SHOWN);

    return rows.map((r) => ({
      ...r,
      address: getAddress(r.address),
      grantedBy: r.grantedBy ? getAddress(r.grantedBy) : null,
    }));
  }
}
