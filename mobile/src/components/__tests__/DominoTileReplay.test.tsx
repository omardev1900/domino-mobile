import React from 'react';
import { render } from '@testing-library/react-native';
import { Circle } from 'react-native-svg';
import { DominoTile } from '../DominoTile';

it('agrandit les points de la main du replay', () => {
    const normal = render(<DominoTile left={1} right={0} size={28} disabled animateOnMount={false} />);
    const replay = render(<DominoTile left={1} right={0} size={28} disabled flat pipScale={1.6} animateOnMount={false} />);
    const normalRadius = Number(normal.UNSAFE_getAllByType(Circle)[0].props.r);
    const replayRadius = Number(replay.UNSAFE_getAllByType(Circle)[0].props.r);
    expect(replayRadius).toBeCloseTo(normalRadius * 1.6);
});
