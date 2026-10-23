import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
  type Address,
} from "viem";
import { ink } from "viem/chains";
import {
  getAccount,
  readContract,
  simulateContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import { wagmiConfig } from "@/config/wagmi";
import { checkInAbi, FEE_BUFFER_PERCENT } from "@/lib/check-in-contract";
import { useAuth } from "@/app/auth/use-auth";
import { ApiError, apiFetch } from "@/lib/api";
import { toast } from "@/lib/notify";

type CheckInResult = { day: string; points: number; bonusPoints: number };

export type Progress = {
  totalXp: number;
  level: number;
  // Total XP at which the current and the next level start.
  levelXp: number;
  nextLevelXp: number;
  streak: number;
  checkedInToday: boolean;
  // Monday to Sunday of the current UTC week: true where checked in.
  week: boolean[];
  checkInXp: number;
  // Extra XP for checking in every day of a Monday-Sunday week.
  fullWeekBonusXp: number;
  // Where to pay for a check-in on Ink; null while check-ins are free.
  // Missing from an API deployed before paid check-ins.
  checkInContract?: Address | null;
};

const msUntilNextUtcDay = () => {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - Date.now();
};

export const useProgress = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["progress", address],
    queryFn: () => apiFetch<Progress>("/me/progress"),
    enabled: Boolean(address),
    // Refetch right after 00:00 UTC so the check-in button comes back on a
    // page left open overnight.
    refetchInterval: () => msUntilNextUtcDay() + 1000,
  });
};

// Where a paid check-in is: waiting on the wallet, or on the chain and our
// backend.
export type CheckInStage = "wallet" | "confirming" | null;

// Our RPC can be a block behind the wallet's, so a just-mined check-in may
// be "not confirmed yet" for a moment.
const CONFIRM_RETRIES = 4;
const CONFIRM_RETRY_MS = 2000;

const isNotConfirmedYet = (err: unknown) =>
  err instanceof ApiError &&
  err.status === 422 &&
  err.message.includes("isn't confirmed yet");

const errorNamed = (err: unknown, name: string) =>
  err instanceof BaseError &&
  Boolean(
    err.walk(
      (e) =>
        e instanceof ContractFunctionRevertedError &&
        e.data?.errorName === name,
    ),
  );

// The backend reads the paid check-in from the contract itself, at the
// payment's block when we have one, so a lagging RPC can't hide it.
const postCheckIn = async (paidAtBlock?: bigint) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await apiFetch<CheckInResult>("/me/check-in", {
        method: "POST",
        ...(paidAtBlock !== undefined && {
          body: JSON.stringify({ blockNumber: paidAtBlock.toString() }),
        }),
      });
    } catch (err) {
      if (!isNotConfirmedYet(err) || attempt >= CONFIRM_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, CONFIRM_RETRY_MS));
    }
  }
};

// Pays for today's check-in on the CheckIn contract; resolves with the
// payment's block once mined. Already paid today (e.g. the tab closed
// before we heard back) resolves too, with no block, so the check-in still
// gets credited.
const payCheckIn = async (
  contract: Address,
  onStage: (stage: CheckInStage) => void,
): Promise<bigint | undefined> => {
  try {
    return await sendCheckIn(contract, onStage);
  } catch (err) {
    if (!errorNamed(err, "AlreadyCheckedInToday")) throw err;
    return undefined;
  }
};

const sendCheckIn = async (
  contract: Address,
  onStage: (stage: CheckInStage) => void,
) => {
  // A wallet on another network is asked to switch to Ink (most wallets
  // offer to add it if missing).
  if (getAccount(wagmiConfig).chainId !== ink.id) {
    try {
      await switchChain(wagmiConfig, { chainId: ink.id });
    } catch (err) {
      // Declining the switch isn't a cancelled check-in: say what's needed.
      throw userError(
        isRejected(err)
          ? "Switch your wallet to the Ink network to check in."
          : "Couldn't switch your wallet to Ink. Switch to the Ink network in your wallet and try again.",
      );
    }
  }
  const fee = await readContract(wagmiConfig, {
    address: contract,
    abi: checkInAbi,
    functionName: "fee",
    chainId: ink.id,
  });
  // Simulated first, so a known revert (already checked in, paused) shows
  // up before the wallet asks to sign.
  const { request } = await simulateContract(wagmiConfig, {
    address: contract,
    abi: checkInAbi,
    functionName: "checkIn",
    value: fee + (fee * FEE_BUFFER_PERCENT) / 100n,
    chainId: ink.id,
  });
  onStage("wallet");
  const hash = await writeContract(wagmiConfig, request);
  onStage("confirming");
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId: ink.id,
  });
  if (receipt.status !== "success") {
    throw userError("The check-in transaction failed. Try again.");
  }
  return receipt.blockNumber;
};

// The user declined in their wallet (EIP-1193 code 4001), anywhere down the
// error's cause chain: viem and wagmi wrap it differently.
const isRejected = (err: unknown) => {
  for (let e = err; e; e = (e as { cause?: unknown }).cause) {
    if (
      e instanceof UserRejectedRequestError ||
      (e as { code?: unknown }).code === 4001 ||
      (e as { name?: unknown }).name === "UserRejectedRequestError"
    ) {
      return true;
    }
  }
  return false;
};

// An error whose text is shown as is in the toast (see lib/notify).
const userError = (text: string) =>
  Object.assign(new Error(text), { shortMessage: text });

// Not enough ETH on Ink for the fee and gas. RPCs word it differently
// ("insufficient funds", "OutOfFunds"), and viem doesn't always map it.
const isOutOfFunds = (err: unknown) =>
  err instanceof BaseError &&
  Boolean(
    err.walk((e) => e instanceof InsufficientFundsError) ||
    /insufficient funds|OutOfFunds/i.test(`${err.details} ${err.message}`),
  );

export const useCheckIn = () => {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<CheckInStage>(null);
  const mutation = useMutation({
    // `contract` is Progress.checkInContract: null while check-ins are free.
    mutationFn: async (contract: Address | null) => {
      try {
        const paidAtBlock = contract
          ? await payCheckIn(contract, setStage)
          : undefined;
        if (contract) setStage("confirming");
        return await postCheckIn(paidAtBlock);
      } catch (err) {
        // Checked in from another tab: the refetch below shows it.
        if (err instanceof ApiError && err.status === 409) return null;
        if (isRejected(err)) return "cancelled" as const;
        if (isOutOfFunds(err)) {
          throw userError(
            "Not enough ETH on Ink in this wallet. A check-in costs about $0.05 in ETH plus gas.",
          );
        }
        throw err;
      } finally {
        setStage(null);
      }
    },
    onSuccess: (result) => {
      if (result === "cancelled") {
        toast.info("Check-in cancelled");
        return;
      }
      if (!result) toast.info("Already checked in today");
      else if (result.bonusPoints > 0) {
        toast.success(`Checked in: +${result.points + result.bonusPoints} XP`, {
          description: `Includes +${result.bonusPoints} XP for a full week of check-ins 🔥`,
        });
      } else toast.success(`Checked in: +${result.points} XP`);

      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["progress"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
        queryClient.invalidateQueries({ queryKey: ["challenge"] }),
        queryClient.invalidateQueries({ queryKey: ["rank"] }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
    },
  });
  return { ...mutation, stage };
};
