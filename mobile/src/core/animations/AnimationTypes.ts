import { Domino } from '../types';

export interface Point {
    x: number;
    y: number;
}

export interface FlyingDominoData {
    animationId: string;
    domino: Domino;
    startPoint: Point;
    endPoint?: Point;
    orientation: 'vertical' | 'horizontal';
    isReversed: boolean;
    baseSize?: number;
    width?: number;
    height?: number;
    visualLeft?: Domino['left'];
    visualRight?: Domino['right'];
    holdAtStart?: boolean;
}
