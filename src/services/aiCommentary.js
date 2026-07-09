/**
 * AI Commentary Service: real-time in-game move explanations and strategic commentary.
 * Builds on the existing LLM Coach infrastructure.
 * @module services/aiCommentary
 */

import { isLlmCoachConfigured, normalizeLlmCoachSettings, fetchWithTimeout, extractAssistantContent } from "./llmCoach.js";

const REQUEST_TEMPERATURE = 0.4;

const COMMENTARY_PROMPTS = {
    gomoku: {
        system: "You are a concise Gomoku commentator. After each move, provide a brief 1-2 sentence explanation of the strategic significance. Focus on: what the move achieves, threats created, and defensive considerations. Be direct and insightful. Use plain language.",
        format: "Respond with a single short paragraph (1-2 sentences max) explaining the last move. No move notation, no headers, just the commentary."
    },
    go: {
        system: "You are a concise Go commentator. After each move, provide a brief 1-2 sentence explanation of the move purpose. Focus on: territory influence, group safety, and tactical opportunities. Be direct and insightful.",
        format: "Respond with a single short paragraph (1-2 sentences max) explaining the last move. No move notation, no headers, just the commentary."
    },
    chess: {
        system: "You are a concise Chess commentator. After each move, provide a brief 1-2 sentence explanation. Focus on: tactical threats, positional improvements, and strategic plans. Be direct and insightful.",
        format: "Respond with a single short paragraph (1-2 sentences max) explaining the last move. No move notation, no headers, just the commentary."
    },
    xiangqi: {
        system: "You are a concise Xiangqi (Chinese Chess) commentator. After each move, provide a brief 1-2 sentence explanation. Focus on: control of key positions, piece coordination, and tactical threats. Be direct and insightful.",
        format: "Respond with a single short paragraph (1-2 sentences max) explaining the last move. No move notation, no headers, just the commentary."
    },
    junqi: {
        system: "You are a concise Junqi (Military Chess) commentator. After each move, provide a brief 1-2 sentence explanation. Focus on: piece revelation implications, attack-defense balance, and flag protection. Be direct and insightful.",
        format: "Respond with a single short paragraph (1-2 sentences max) explaining the last move. No move notation, no headers, just the commentary."
    },
    othello: {
        system: "You are a concise Othello (Reversi) commentator. After each move, provide a brief 1-2 sentence explanation. Focus on: disc flips, positional advantage, corner control, and mobility. Be direct and insightful.",
        format: "Respond with a single short paragraph (1-2 sentences max) explaining the last move. No move notation, no headers, just the commentary."
    },
    shogi: {
        system: "You are a concise Shogi (Japanese Chess) commentator. After each move, provide a brief 1-2 sentence explanation. Focus on: piece exchanges, drop tactics, promotion timing, and king safety. Be direct and insightful.",
        format: "Respond with a single short paragraph (1-2 sentences max) explaining the last move. No move notation, no headers, just the commentary."
    }
};

/**
 * Request AI commentary for a move that was just played.
 * @param {Object} options
 * @param {Object} options.settings - Normalized LLM settings
 * @param {Object} options.snapshot - Game state snapshot including last move and board
 * @param {AbortSignal} [options.signal] - Abort signal
 * @param {string} options.gameType - Game type key (gomoku, go, chess, xiangqi, junqi, othello, shogi)
 * @returns {Promise<string>} Commentary text
 */
export async function requestMoveCommentary({ settings, snapshot, signal, gameType } = {}) {
    const config = COMMENTARY_PROMPTS[gameType] || COMMENTARY_PROMPTS.gomoku;
    const normalized = normalizeLlmCoachSettings(settings);

    if (!isLlmCoachConfigured(normalized)) {
        return null;
    }

    const moveHistory = snapshot.moveHistory || [];
    const lastMoves = moveHistory.slice(-6);
    const historyText = lastMoves.length > 0
        ? "Recent moves: " + lastMoves.map((m, i) => {
            const num = moveHistory.length - lastMoves.length + i + 1;
            const coords = m.row !== undefined ? "(" + m.row + "," + m.col + ")" : "";
            return num + ". " + (m.color || m.player || "?") + " " + (m.action || "move") + " " + coords;
        }).join("; ")
        : "";

    const boardSize = snapshot.boardSize || snapshot.size || 15;
    const currentPlayer = snapshot.currentPlayer || "?";
    const lastMove = snapshot.lastMove || moveHistory[moveHistory.length - 1] || null;
    const lastMoveDesc = lastMove
        ? (lastMove.color || lastMove.player || "?") + " at (" + (lastMove.row ?? "?") + "," + (lastMove.col ?? "?") + ")"
        : "opening move";

    const messages = [
        { role: "system", content: config.system + " " + config.format },
        {
            role: "user",
            content: [
                "Game: " + gameType + ", Board: " + boardSize + "x" + boardSize,
                "Current player: " + currentPlayer,
                "Last move: " + lastMoveDesc,
                historyText,
                "Provide commentary on this position."
            ].filter(Boolean).join("\n")
        }
    ];

    const body = {
        model: normalized.model,
        messages,
        temperature: REQUEST_TEMPERATURE,
        max_tokens: 120
    };

    const response = await fetchWithTimeout(normalized.baseUrl + "/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + normalized.apiKey
        },
        body: JSON.stringify(body),
        signal
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch {
        return null;
    }

    if (!response.ok) {
        return null;
    }

    return extractAssistantContent(payload);
}

/**
 * Build a simple in-memory commentary cache keyed by game+move count.
 */
const commentaryCache = new Map();

/**
 * Get or request commentary with simple deduplication.
 * Prevents duplicate requests for the same move state.
 */
export async function getMoveCommentary({ settings, snapshot, signal, gameType } = {}) {
    const moveCount = (snapshot.moveHistory || []).length;
    const cacheKey = gameType + ":" + moveCount;

    if (commentaryCache.has(cacheKey)) {
        return commentaryCache.get(cacheKey);
    }

    const result = await requestMoveCommentary({ settings, snapshot, signal, gameType });
    commentaryCache.set(cacheKey, result);

    // Evict old entries (keep last 20)
    if (commentaryCache.size > 20) {
        const firstKey = commentaryCache.keys().next().value;
        commentaryCache.delete(firstKey);
    }

    return result;
}

/**
 * Clear the commentary cache (e.g., on new game start).
 */
export function clearCommentaryCache() {
    commentaryCache.clear();
}

/**
 * Check if commentary is available for given settings.
 */
export function isCommentaryAvailable(settings) {
    const normalized = normalizeLlmCoachSettings(settings);
    return isLlmCoachConfigured(normalized);
}
