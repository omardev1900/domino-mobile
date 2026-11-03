import { economyService } from './economy.service';
import { readConfirmedReplayBalance } from './replayBalance';

/** A local snapshot is not proof of the latest balance: use the server after settlement. */
export async function confirmReplaySettlement(settlement: Promise<void>, uid: string): Promise<void> {
    await settlement;
    const coins = await readConfirmedReplayBalance(uid);
    await economyService.applyConfirmedReplayBalance(coins);
}
