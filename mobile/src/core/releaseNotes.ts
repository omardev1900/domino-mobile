export const RELEASE_VERSION = '2.5.4';

export const RELEASE_SECTIONS = [
    { title: 'Nouveautés', notes: [
        'Les membres Premium conservent une réserve de 100 pièces pour continuer à jouer en solo et en multijoueur.',
    ] },
    { title: 'Améliorations', notes: [
        'Le lancement des matchs multijoueurs tient compte des publicités et du statut Premium des joueurs.',
        'Les scores de fin de match s’affichent dès la fermeture de votre publicité. Un membre Premium accède directement aux scores.',
        'Correction de la répétition de la publicité de fin de partie en solo.',
    ] },
] as const;

export const PREVIOUS_RELEASE_VERSION = '2.5.3';
export const PREVIOUS_RELEASE_SECTIONS = [
    { title: 'Nouveautés', notes: [
        'Les membres Premium peuvent consulter leur historique mensuel dans Mes Stats : parties jouées, victoires et cochons donnés.',
    ] },
    { title: 'Améliorations', notes: [
        'Correction du remplacement d’un replay sauvegardé : le nouvel achat ne supprime l’ancien replay qu’après validation.',
        'Un replay déjà acheté peut maintenant être relu gratuitement, sans nouvelle demande de paiement.',
        'Amélioration de la fiabilité des appels replay et de la gestion des erreurs d’authentification.',
        'Correction définitive de l’erreur unauthenticated [401] lors de la sauvegarde ou de la lecture d’un replay sur Android.',
        'En cas de 401 pendant la récompense de fin de partie, un second chemin sécurisé avec jeton Bearer est utilisé automatiquement.',
    ] },
] as const;

export const RELEASE_NOTES = RELEASE_SECTIONS.flatMap(section => section.notes);
export const RELEASE_NOTES_ACKNOWLEDGMENT_KEY = '@release_notes_acknowledged_version';
export function hasAcknowledgedReleaseNotes(acknowledgedVersion: string | null): boolean {
    return acknowledgedVersion === RELEASE_VERSION;
}
