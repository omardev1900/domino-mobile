import React from 'react';
import { render } from '@testing-library/react-native';
import { PlayerHand } from '../PlayerHand';
import { Domino } from '../../core/types';

jest.mock('../DominoTile', () => ({
    DominoTile: ({ left, right, onPress, disabled }: any) => {
        const ReactNative = require('react-native');
        return (
            <ReactNative.TouchableOpacity onPress={onPress} disabled={disabled} testID={`tile-${left}-${right}`}>
                <ReactNative.Text>{`${left}|${right}`}</ReactNative.Text>
            </ReactNative.TouchableOpacity>
        );
    },
}));

jest.mock('../../core/LogicEngine', () => ({
    checkValidMove: () => ({ canPlay: true }),
}));

const makeDomino = (id: string, left: number, right: number): Domino => ({
    id,
    left: left as Domino['left'],
    right: right as Domino['right'],
    isDouble: left === right,
});

describe('PlayerHand', () => {
    const hand: Domino[] = [
        makeDomino('a', 2, 5),
        makeDomino('b', 6, 6),
        makeDomino('c', 4, 4),
        makeDomino('d', 3, 6),
    ];

    it('uses the auto sort by default', () => {
        const { getAllByText } = render(
            <PlayerHand hand={hand} onPlayDomino={jest.fn()} />
        );

        expect(getAllByText(/^\d\|\d$/).map(node => node.props.children)).toEqual([
            '6|6',
            '4|4',
            '3|6',
            '2|5',
        ]);
    });

    it('groups doubles first while preserving original order inside groups', () => {
        const { getAllByText } = render(
            <PlayerHand hand={hand} onPlayDomino={jest.fn()} sortMode="DOUBLES" />
        );

        expect(getAllByText(/^\d\|\d$/).map(node => node.props.children)).toEqual([
            '6|6',
            '4|4',
            '2|5',
            '3|6',
        ]);
    });

    it('sorts by descending sum when sum mode is selected', () => {
        const { getAllByText } = render(
            <PlayerHand hand={hand} onPlayDomino={jest.fn()} sortMode="SUM" />
        );

        expect(getAllByText(/^\d\|\d$/).map(node => node.props.children)).toEqual([
            '6|6',
            '3|6',
            '4|4',
            '2|5',
        ]);
    });

    it('keeps the selected sort mode after the hand changes', () => {
        const { getAllByText, rerender } = render(
            <PlayerHand hand={hand} onPlayDomino={jest.fn()} sortMode="SUM" />
        );

        rerender(
            <PlayerHand
                hand={[makeDomino('e', 1, 1), makeDomino('f', 6, 4), makeDomino('g', 0, 5)]}
                onPlayDomino={jest.fn()}
                sortMode="SUM"
            />
        );

        expect(getAllByText(/^\d\|\d$/).map(node => node.props.children)).toEqual([
            '6|4',
            '0|5',
            '1|1',
        ]);
    });
});
