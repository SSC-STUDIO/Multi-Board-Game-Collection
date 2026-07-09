/**
 * Tournament bracket system.
 * Supports single-elimination brackets with configurable sizes.
 * @module tournament/bracket
 */

/**
 * Create a single-elimination bracket.
 * @param {Array<{name: string, id?: string}>} players - List of players
 * @returns {Object} Bracket with rounds and matches
 */
export function createBracket(players) {
    const size = nextPowerOf2(players.length);
    const byesNeeded = size - players.length;
    const seeds = [];

    // In seeded single-elimination brackets, byes are awarded to the TOP
    // seeds so that the strongest players are protected in the first round.
    // The previous interleave placed byes at odd (player2) slots starting
    // from index 1, effectively awarding them to the *last* seeds — the
    // exact opposite of correct seeding.
    //
    // Fix: the first `byesNeeded` seeds receive a bye, so we place each
    // top seed in the player1 slot of a match and fill the matching
    // player2 slot with BYE.  Remaining seeds fill the rest of the
    // bracket in order.
    let playerIdx = 0;
    for ( let i = 0; i < size; i++ ) {
        if ( i % 2 === 1 && (i >>> 1) < byesNeeded ) {
            seeds.push( { name: "BYE", id: "bye" } );
        } else {
            seeds.push( players[playerIdx++] );
        }
    }

    const rounds = [];
    const numRounds = Math.log2(size);

    // First round matches
    const firstRound = [];
    for (let i = 0; i < size; i += 2) {
        firstRound.push({
            id: `match-0-${i / 2}`,
            round: 0,
            player1: seeds[i],
            player2: seeds[i + 1],
            winner: null,
            score1: 0,
            score2: 0,
            completed: seeds[i + 1]?.id === "bye"
        });
        if (seeds[i + 1]?.id === "bye") {
            firstRound[firstRound.length - 1].winner = seeds[i];
        }
    }
    rounds.push(firstRound);

    // Subsequent rounds (empty until matches are played)
    for (let r = 1; r < numRounds; r++) {
        const roundSize = size / Math.pow(2, r + 1);
        const round = [];
        for (let i = 0; i < roundSize; i++) {
            round.push({
                id: `match-${r}-${i}`,
                round: r,
                player1: null,
                player2: null,
                winner: null,
                score1: 0,
                score2: 0,
                completed: false
            });
        }
        rounds.push(round);
    }

    return {
        size,
        numRounds,
        rounds,
        champion: null
    };
}

/**
 * Check if a match is ready to be played.
 */
export function isMatchReady(bracket, round, matchIndex) {
    const match = bracket.rounds[round]?.[matchIndex];
    if (!match) return false;
    return Boolean(match.player1 && match.player2 && !match.completed);
}

/**
 * Report a match result and advance the winner.
 */
export function reportMatchResult(bracket, round, matchIndex, winner, score1 = 0, score2 = 0) {
    const match = bracket.rounds[round]?.[matchIndex];
    if (!match) return false;
    if (match.completed) return false;

    match.winner = winner;
    match.score1 = score1;
    match.score2 = score2;
    match.completed = true;

    // Advance winner to next round
    if (round < bracket.numRounds - 1) {
        const nextRound = bracket.rounds[round + 1];
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextMatch = nextRound[nextMatchIndex];

        if (matchIndex % 2 === 0) {
            nextMatch.player1 = winner;
        } else {
            nextMatch.player2 = winner;
        }
    } else {
        // Final match completed
        bracket.champion = winner;
    }

    return true;
}

/**
 * Get all matches that are ready to be played.
 * @returns {Array<{round: number, matchIndex: number, match: Object}>}
 */
export function getReadyMatches(bracket) {
    const ready = [];
    for (let r = 0; r < bracket.numRounds; r++) {
        for (let i = 0; i < bracket.rounds[r].length; i++) {
            if (isMatchReady(bracket, r, i)) {
                ready.push({ round: r, matchIndex: i, match: bracket.rounds[r][i] });
            }
        }
    }
    return ready;
}

/**
 * Check if the tournament is complete.
 */
export function isTournamentComplete(bracket) {
    return bracket.champion !== null;
}

/**
 * Get tournament status summary.
 */
export function getTournamentStatus(bracket) {
    let totalMatches = 0;
    let completedMatches = 0;

    for (const round of bracket.rounds) {
        for (const match of round) {
            totalMatches++;
            if (match.completed) completedMatches++;
        }
    }

    return {
        totalMatches,
        completedMatches,
        currentRound: bracket.numRounds - Math.ceil(Math.log2(totalMatches - completedMatches + 1)),
        champion: bracket.champion,
        isComplete: bracket.champion !== null
    };
}

function nextPowerOf2(n) {
    let size = 1;
    while (size < n) size *= 2;
    return size;
}
