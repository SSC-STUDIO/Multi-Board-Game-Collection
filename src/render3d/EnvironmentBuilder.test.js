import { describe, it, expect, vi } from 'vitest';
import { applyTabletopMood, getTabletopMood } from './scenes/tabletop.js';

describe('tabletop moods', () => {
    it('returns distinct colors for home, park and competition', () => {
        const home = getTabletopMood('home');
        const park = getTabletopMood('park');
        const competition = getTabletopMood('competition');

        expect(home.floor).not.toBe(park.floor);
        expect(park.table).not.toBe(competition.table);
        expect(home.backdrop).not.toBe(competition.backdrop);
    });

    it('applies mood colors onto existing materials without rebuilding', () => {
        const materials = {
            floor: { color: { setHex: vi.fn() } },
            table: { color: { setHex: vi.fn() } },
            legs: { color: { setHex: vi.fn() } },
            backdrop: { color: { setHex: vi.fn() } },
            lamp: { color: { setHex: vi.fn() } }
        };

        applyTabletopMood(materials, 'home');
        const home = getTabletopMood('home');
        expect(materials.floor.color.setHex).toHaveBeenCalledWith(home.floor);
        expect(materials.table.color.setHex).toHaveBeenCalledWith(home.table);
        expect(materials.backdrop.color.setHex).toHaveBeenCalledWith(home.backdrop);
    });
});
