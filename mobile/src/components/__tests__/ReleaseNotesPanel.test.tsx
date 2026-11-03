import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ReleaseNotesPanel } from '../ReleaseNotesPanel';

it('affiche les notes 2.4.0 et permet de fermer la fenêtre', () => {
    const close = jest.fn();
    const view = render(<ReleaseNotesPanel onClose={close} />);
    expect(view.getByText('Version 2.4.0')).toBeTruthy();
    expect(view.getByText('Nouveautés')).toBeTruthy();
    expect(view.getByText('Améliorations')).toBeTruthy();
    expect(view.getByText(/2 000 coins/)).toBeTruthy();
    fireEvent.press(view.getByLabelText('Fermer les notes de version'));
    expect(close).toHaveBeenCalledTimes(1);
});
