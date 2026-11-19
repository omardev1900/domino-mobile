import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { GameRoom } from '../../core/types';
import { gameFunctions } from '../../core/services/firebase';
import { LogService } from '../../core/services/LogService';
import { getEstimatedPresenceServerNow } from './presenceDiagnostics';
import { createMultiplayerInterstitial } from '../../core/services/multiplayerInterstitial';

type Interstitial = ReturnType<typeof createMultiplayerInterstitial>;

export function useMultiplayerAdCycle(room: GameRoom | null, uid: string, showAfterResult: boolean) {
    const [foreground, setForeground] = useState(AppState.currentState === 'active');
    const [completedId, setCompletedId] = useState<string>();
    const adRef = useRef<Interstitial>(null);
    const attempted = useRef<string | undefined>(undefined);
    const showing = useRef<string | undefined>(undefined);
    const opened = useRef(false);
    const cycle = room?.adCycle;
    const capable = room?.players.some(profile => profile.uid === uid && profile.multiplayerAdVersion === 1);
    const roomId = room?.roomId;
    const eligible = !!cycle && room?.participantIds?.includes(uid) && !cycle.confirmedPlayerIds.includes(uid);

    useEffect(() => {
        if (!capable) return;
        setForeground(AppState.currentState === 'active');
        const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
        return () => listener.remove();
    }, [capable]);

    useEffect(() => {
        if (!capable) return;
        const ad = createMultiplayerInterstitial();
        if (!ad) return;
        adRef.current = ad;
        const complete = () => {
            const id = showing.current;
            if (!id) return;
            showing.current = undefined;
            opened.current = false;
            setCompletedId(id);
            ad.load();
        };
        const unsubscribe = ad.subscribe({
            opened: () => { opened.current = true; },
            closed: complete,
            error: error => {
                if (!showing.current || opened.current) return;
                LogService.warn('MultiplayerAdCycle', 'Interstitial failed before opening.', error);
                complete();
            },
        });
        ad.load();
        return () => {
            unsubscribe();
            adRef.current = null;
        };
    }, [capable]);

    useEffect(() => {
        if (!cycle || !eligible || !foreground || AppState.currentState !== 'active'
            || (cycle.kind !== 'START' && !showAfterResult)
            || attempted.current === cycle.id || showing.current) return;
        attempted.current = cycle.id;
        const ad = adRef.current;
        if (!ad?.loaded || cycle.reconnecting || (getEstimatedPresenceServerNow() ?? Date.now()) >= cycle.deadline) {
            setCompletedId(cycle.id);
            if (ad && !ad.loaded) ad.load();
            return;
        }
        showing.current = cycle.id;
        const onShowError = (error: unknown) => {
            LogService.warn('MultiplayerAdCycle', 'Unable to show interstitial.', error);
            if (showing.current !== cycle.id || opened.current) return;
            showing.current = undefined;
            setCompletedId(cycle.id);
            ad.load();
        };
        try {
            void ad.show().catch(onShowError);
        } catch (error) {
            onShowError(error);
        }
    }, [cycle, eligible, foreground, showAfterResult]);

    const cycleId = cycle?.id;
    useEffect(() => {
        if (!roomId || !cycleId || !eligible || !foreground || completedId !== cycleId) return;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const confirm = httpsCallable(gameFunctions, 'confirmMultiplayerAd', { timeout: 8000 });
        const send = async () => {
            if (!active || AppState.currentState !== 'active') return;
            try {
                await confirm({ roomId, cycleId });
            } catch (error) {
                LogService.warn('MultiplayerAdCycle', 'Unable to confirm interstitial.', error);
                if (active) timer = setTimeout(() => { void send(); }, 2500);
            }
        };
        void send();
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [completedId, cycleId, eligible, foreground, roomId]);

    return Boolean(eligible && completedId !== cycleId);
}
