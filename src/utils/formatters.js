import { COLUMN_LABELS, PLAYER_LABELS } from '../config/gameConfig.js';
import { i18n } from './i18n.js';

export function getPlayerLabel(color) {
    const localized = i18n.t(color);
    return localized === color ? PLAYER_LABELS[color] : localized;
}

export function formatMove(row, col) {
    const column = COLUMN_LABELS[col] || `C${col + 1}`;
    return `${column}${row + 1}`;
}
