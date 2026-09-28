import { createPublicClient, http } from 'viem';
import { ink } from 'viem/chains';

// Read-only client for Ink; `rpcUrl` falls back to viem's public Ink RPC.
export const createInkClient = (rpcUrl?: string) =>
  createPublicClient({ chain: ink, transport: http(rpcUrl) });

export type InkClient = ReturnType<typeof createInkClient>;
