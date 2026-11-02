import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { LogService } from '../services/LogService';
import { Campaign, CampaignHistory, CampaignPlacement, campaignSchema, selectCampaign } from './campaignPolicy';

let displayedSession = false;
let reserved = false;
const shownSession = new Set<string>();
const storageKey = (uid: string) => `@campaign_history:${uid}`;

/** Une campagne au maximum par lancement, partagée entre les écrans. */
export function useCampaign(placement: CampaignPlacement, enabled: boolean) {
    const focused = useIsFocused();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!enabled || !focused || !uid || displayedSession || campaign) return;
        let cancelled = false;
        const unsubscribe = onSnapshot(collection(db, 'campaigns'), { includeMetadataChanges: true }, snapshot => {
            if (snapshot.metadata.fromCache) return;
            void (async () => {
                if (reserved || displayedSession) return;
                reserved = true;
                try {
                    const entitlement = await getDocFromServer(doc(db, 'premium_entitlements', uid));
                    const expiresAt = entitlement.data()?.expiresAt;
                    if (entitlement.exists() && (!expiresAt || typeof expiresAt.toMillis !== 'function')) return;
                    const premium = entitlement.exists() && expiresAt.toMillis() > Date.now();
                    const stored = await AsyncStorage.getItem(storageKey(uid));
                    const dates: Record<string, number> = stored ? JSON.parse(stored) : {};
                    const history: Record<string, CampaignHistory> = {};
                    for (const [id, shownAt] of Object.entries(dates)) history[id] = { shownAt, shownThisSession: shownSession.has(`${uid}:${id}`) };
                    if (cancelled || auth.currentUser?.uid !== uid) return;
                    const chosen = selectCampaign(snapshot.docs.map(d => ({ id: d.id, data: d.data() })), { placement, premium, now: Date.now(), sessionHasCampaign: displayedSession, history });
                    if (!chosen) return;
                    // Persister avant affichage : après une interruption, la limite reste respectée.
                    dates[chosen.id] = Date.now();
                    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(dates));
                    if (cancelled || auth.currentUser?.uid !== uid) return;
                    shownSession.add(`${uid}:${chosen.id}`);
                    displayedSession = true;
                    setCampaign(chosen);
                } catch (error) { LogService.warn('Campaign', 'Impossible de charger la campagne.', error); }
                finally { reserved = false; }
            })();
        }, error => LogService.warn('Campaign', 'Impossible de lire les campagnes.', error));
        return () => { cancelled = true; unsubscribe(); };
    }, [placement, enabled, focused, campaign]);
    useEffect(() => {
        if (!campaign) return;
        const unsubscribe = onSnapshot(doc(db, 'campaigns', campaign.id), snapshot => {
            if (snapshot.metadata.fromCache) return;
            const parsed = campaignSchema.safeParse(snapshot.data());
            if (!snapshot.exists() || !parsed.success || !parsed.data.active || Date.now() >= parsed.data.endsAt) setCampaign(null);
        });
        let timer: ReturnType<typeof setTimeout>;
        const scheduleExpiry = () => {
            const remaining = campaign.endsAt - Date.now();
            if (remaining <= 0) { setCampaign(null); return; }
            timer = setTimeout(scheduleExpiry, Math.min(remaining, 2147483647));
        };
        scheduleExpiry();
        return () => { unsubscribe(); clearTimeout(timer); };
    }, [campaign]);
    useEffect(() => { if (!focused) setCampaign(null); }, [focused]);
    return { campaign, dismiss: () => setCampaign(null) };
}
