import { z } from 'zod';

// Les campagnes sont distinctes des publicités récompensées et des anciennes fiches ads.
const httpsUrl = z.string().url().refine(value => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
});

export const campaignSchema = z.object({
    title: z.string().trim().min(1).max(120),
    message: z.string().max(500).default(''),
    imageUrl: httpsUrl,
    buttonLabel: z.string().trim().min(1).max(60),
    destination: z.discriminatedUnion('type', [
        z.object({ type: z.literal('STORE') }),
        z.object({ type: z.literal('PREMIUM') }),
        z.object({ type: z.literal('EXTERNAL'), url: httpsUrl }),
    ]),
    active: z.boolean(),
    startsAt: z.number().finite(),
    endsAt: z.number().finite(),
    audience: z.enum(['ALL', 'FREE', 'PREMIUM']),
    placements: z.array(z.enum(['HOME', 'STORE', 'PREMIUM'])).min(1),
    frequency: z.enum(['SESSION', 'DAY', 'ONCE']),
    priority: z.number().int().min(0).max(100),
}).refine(campaign => campaign.startsAt < campaign.endsAt);

export type Campaign = z.infer<typeof campaignSchema> & { id: string };
export type CampaignPlacement = 'HOME' | 'STORE' | 'PREMIUM';
export interface CampaignHistory { shownAt?: number; shownThisSession: boolean }

/** Détermine la campagne prioritaire sans supposer que les données Firestore sont valides. */
export function selectCampaign(
    documents: { id: string; data: unknown }[],
    options: { placement: CampaignPlacement; premium: boolean; now: number; sessionHasCampaign: boolean; history: Record<string, CampaignHistory> },
): Campaign | null {
    if (options.sessionHasCampaign) return null;
    const candidates: Campaign[] = [];
    for (const document of documents) {
        const parsed = campaignSchema.safeParse(document.data);
        if (!parsed.success) continue;
        const campaign = { ...parsed.data, id: document.id };
        const history = options.history[campaign.id];
        if (!campaign.active || options.now < campaign.startsAt || options.now >= campaign.endsAt) continue;
        if (!campaign.placements.includes(options.placement)) continue;
        if (campaign.audience === 'PREMIUM' && !options.premium) continue;
        if (campaign.audience === 'FREE' && options.premium) continue;
        if (campaign.frequency === 'ONCE' && history?.shownAt !== undefined) continue;
        if (campaign.frequency === 'SESSION' && history?.shownThisSession) continue;
        if (campaign.frequency === 'DAY' && history?.shownAt !== undefined) {
            const last = new Date(history.shownAt);
            const today = new Date(options.now);
            if (last.toDateString() === today.toDateString()) continue;
        }
        candidates.push(campaign);
    }
    return candidates.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] ?? null;
}
