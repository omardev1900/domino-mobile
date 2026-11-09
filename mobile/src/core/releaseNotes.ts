export const RELEASE_VERSION = '2.4.0';

export const RELEASE_SECTIONS = [
    { title: 'Nouveautés', notes: [
        'Replays Premium : achète et sauvegarde un replay de match solo ou multijoueur pour 2 000 coins, après confirmation.',
        'Retrouve ton replay dans ton espace Premium et revois-le gratuitement. Un emplacement est inclus ; tu peux remplacer ou supprimer son replay.',
        'Pilote le replay à ton rythme : lecture, pause, vitesse, choix de la manche et de la partie. Affiche les mains adverses si tu le souhaites.',
        'Découvre le nouvel espace Premium et ses accès directs aux replays, à l’atelier des skins, à l’entraînement avancé et à la boutique.',
    ] },
    { title: 'Améliorations', notes: [
        'Les campagnes et leurs images s’affichent mieux en mode paysage.',
        'La récompense de base du vainqueur est de 250 coins, doublée pour les joueurs Premium. La mise est de 100 coins pour les trois niveaux de table.',
        'Correction liée au démarrage de l’application sur Android 15.',
    ] },
] as const;

export const RELEASE_NOTES = RELEASE_SECTIONS.flatMap(section => section.notes);
export const RELEASE_NOTES_ACKNOWLEDGMENT_KEY = '@release_notes_acknowledged_version';
export function hasAcknowledgedReleaseNotes(acknowledgedVersion: string | null): boolean {
    return acknowledgedVersion === RELEASE_VERSION;
}
