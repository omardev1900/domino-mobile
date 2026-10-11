export function describeMultiplayerJoinError(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    const normalizedMessage = message.toLocaleLowerCase('fr-FR');

    if (normalizedMessage.includes('table est complete') || normalizedMessage.includes('table is full')) {
        return 'Cette table est complète : elle accueille déjà 3 joueurs.';
    }
    if (normalizedMessage.includes('n’existe plus') || normalizedMessage.includes("n'existe plus")) {
        return 'Cette table n’existe plus. Vérifiez le code ou actualisez la liste.';
    }
    if (normalizedMessage.includes('a deja commence') || normalizedMessage.includes('a déjà commencé')) {
        return 'La partie a déjà commencé : cette table ne peut plus être rejointe.';
    }
    if (normalizedMessage.includes('permission-denied') || normalizedMessage.includes('insufficient permissions')) {
        return 'La jointure a été refusée. Vérifiez votre connexion puis réessayez.';
    }

    return 'Impossible de rejoindre cette table pour le moment. Réessayez dans un instant.';
}
