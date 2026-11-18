import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ReleaseNotesPanel } from '../ReleaseNotesPanel';

it('met en avant les notes 2.5.3, conserve les notes 2.5.2 et permet de fermer la fenêtre', () => {
    const close = jest.fn();
    const view = render(<ReleaseNotesPanel onClose={close} />);
    expect(view.getAllByText('Version 2.5.3')).toHaveLength(2);
    expect(view.getByText('Version 2.5.2')).toBeTruthy();
    expect(view.getByText('À LA UNE')).toBeTruthy();
    expect(view.getAllByText('Nouveautés')).toHaveLength(2);
    expect(view.getAllByText('Améliorations')).toHaveLength(2);
    expect(view.getAllByText(/historique mensuel/)).toHaveLength(2);
    fireEvent.press(view.getByLabelText('Fermer les notes de version'));
    expect(close).toHaveBeenCalledTimes(1);
});
