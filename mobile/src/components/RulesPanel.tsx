
import React from 'react';

export const RulesPanel: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
      <div className="space-y-6">
        <div className="bg-stone-800 border-l-4 border-amber-500 p-6 rounded-r-xl">
          <h3 className="text-xl font-bold mb-3 text-amber-500 uppercase tracking-tight">Configuration 3 Joueurs</h3>
          <p className="text-stone-300 leading-relaxed">
            Le jeu utilise un set de 28 dominos (Double-Six). Chaque joueur reçoit <strong>7 dominos</strong>.
            Les 7 dominos restants forment le <strong>&quot;talon mort&quot;</strong> : ils sont écartés et ne sont jamais piochés.
          </p>
        </div>

        <div className="bg-stone-800 border-l-4 border-amber-500 p-6 rounded-r-xl">
          <h3 className="text-xl font-bold mb-3 text-amber-500 uppercase tracking-tight">Premier Tour vs Suivants</h3>
          <ul className="space-y-3 text-stone-300">
            <li className="flex gap-2">
              <span className="text-amber-500 font-bold">●</span>
              <span><strong>Départ initial :</strong> Le plus gros double en main commence. Si aucun double, la plus grosse somme.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500 font-bold">●</span>
              <span><strong>Sens :</strong> Rotation <strong>Anti-Horaire</strong> impérative.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500 font-bold">●</span>
              <span><strong>Tours suivants :</strong> Le vainqueur de la partie précédente entame le nouveau tour.</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-stone-800 border-l-4 border-amber-500 p-6 rounded-r-xl">
          <h3 className="text-xl font-bold mb-3 text-amber-500 uppercase tracking-tight">Le &quot;Boudé&quot; (Blocage)</h3>
          <p className="text-stone-300 leading-relaxed">
            Si plus aucun joueur ne peut poser de domino, la partie est bloquée.
            Le gagnant est celui qui possède le <strong>moins de points</strong> en main.
          </p>
        </div>

        <div className="bg-stone-800 border-l-4 border-amber-500 p-6 rounded-r-xl">
          <h3 className="text-xl font-bold mb-3 text-amber-500 uppercase tracking-tight">La Manche &amp; Le &quot;Cochon&quot;</h3>
          <p className="text-stone-300 leading-relaxed">
            Une manche se gagne en remportant <strong>3 parties</strong>.
            Si un joueur finit la manche avec 0 victoire, il est déclaré <strong>&quot;Cochon&quot;</strong>,
            ce qui entraîne une pénalité au score global.
          </p>
        </div>

        <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl italic text-amber-200/70 text-sm">
          Note de l&apos;architecte : Cette variante est spécifique à la Martinique et nécessite une gestion rigoureuse de l&apos;état &apos;Blocked&apos; car 7 dominos sont hors-jeu, augmentant la probabilité de boudage.
        </div>
      </div>
    </div>
  );
};
