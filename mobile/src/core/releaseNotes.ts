export const RELEASE_VERSION = '2.0.16';

export const RELEASE_NOTES = [
    'Réorganisez librement vos dominos par glisser-déposer.',
    'Diverses corrections améliorent la stabilité générale du jeu.',
    'Consultez le nombre de joueurs actuellement disponibles en ligne.',
    'Personnalisez l’apparence de vos dominos depuis les options de jeu.',
    'Affrontez les bots dans des parties plus fluides et mieux synchronisées.',
    'Découvrez de nouveaux skins et un catalogue Premium dans la boutique.',
    'Les tours expirés, abandons et reprises de partie sont désormais mieux gérés.',
    'Jouez en multijoueur plus sereinement : création et accès aux tables améliorés.',
    'Profitez d’une meilleure fin de manche : résultat plus lisible et animation du vainqueur.',
    'Découvrez le nouveau parcours d’apprentissage pour débuter et progresser à votre rythme.',
] as const;

export const RELEASE_NOTES_ACKNOWLEDGMENT_KEY = '@release_notes_acknowledged_version';

export function hasAcknowledgedReleaseNotes(acknowledgedVersion: string | null): boolean {
    return acknowledgedVersion === RELEASE_VERSION;
}
