
export default class PokerEvaluator {
    constructor() {
        this.RANKS = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
            'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        this.SUITS = ['♠', '♥', '♣', '♦'];
    }

    // Main entry: evaluate 7 cards (2 hand + 5 community) to find the best 5-card hand
    evaluate(handCards, communityCards) {
        const allCards = [...handCards, ...communityCards];
        // If less than 5 cards, just evaluate what we have (should not happen in showdown)
        if (allCards.length < 5) return this.getScore(allCards);

        const combinations = this.getCombinations(allCards, 5);
        let bestScore = { rank: -1, value: 0 };
        let bestHand = null;

        for (const combo of combinations) {
            const score = this.getScore(combo);
            if (this.compareScores(score, bestScore) > 0) {
                bestScore = score;
                bestHand = combo;
            }
        }

        return {
            score: bestScore,
            bestHand: bestHand,
            name: this.getHandName(bestScore.rank)
        };
    }

    getCombinations(arr, k) {
        const result = [];
        function backtrack(start, current) {
            if (current.length === k) {
                result.push([...current]);
                return;
            }
            for (let i = start; i < arr.length; i++) {
                current.push(arr[i]);
                backtrack(i + 1, current);
                current.pop();
            }
        }
        backtrack(0, []);
        return result;
    }

    // Evaluate a 5-card hand
    getScore(cards) {
        // Parse cards to numeric values
        const parsed = cards.map(c => ({
            rank: typeof c.rank === 'string' ? this.RANKS[c.rank] || parseInt(c.rank) : c.rank,
            suit: c.suit
        })).sort((a, b) => b.rank - a.rank);

        const ranks = parsed.map(c => c.rank);
        const suits = parsed.map(c => c.suit);

        const isFlush = suits.every(s => s === suits[0]);
        
        // Check Straight
        let isStraight = false;
        let straightHigh = 0;
        // Check normal straight
        let uniqueRanks = [...new Set(ranks)];
        if (uniqueRanks.length >= 5) {
             // Since ranks are sorted desc, check for consecutive
             // But we only have 5 cards here.
             // Just check if ranks[0] - ranks[4] == 4 and uniqueRanks.length == 5
             // Actually, duplicates make it not a straight in 5 cards, so uniqueRanks.length must be 5
             if (uniqueRanks.length === 5 && uniqueRanks[0] - uniqueRanks[4] === 4) {
                 isStraight = true;
                 straightHigh = uniqueRanks[0];
             }
             // Special case: A-5-4-3-2 (Wheel)
             // ranks would be [14, 5, 4, 3, 2]
             if (!isStraight && 
                 ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
                 isStraight = true;
                 straightHigh = 5; // 5 is the high card of the straight 5-4-3-2-A
             }
        }

        const rankCounts = {};
        ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
        const counts = Object.values(rankCounts);
        
        const isFour = counts.includes(4);
        const isThree = counts.includes(3);
        const pairs = counts.filter(c => c === 2).length;

        // Determine Rank and Kickers
        // Rank: 0-9
        // Kickers: Array of card values to break ties
        
        if (isStraight && isFlush) {
            if (straightHigh === 14 && ranks[1] === 13) { // Royal Flush (A-K-Q-J-10)
                 return { rank: 9, kickers: [] };
            }
            return { rank: 8, kickers: [straightHigh] };
        }
        
        if (isFour) {
            const fourRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 4));
            const kicker = ranks.find(r => r !== fourRank);
            return { rank: 7, kickers: [fourRank, kicker] };
        }
        
        if (isThree && pairs >= 1) {
            const threeRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 3));
            const pairRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 2));
            return { rank: 6, kickers: [threeRank, pairRank] };
        }
        
        if (isFlush) {
            return { rank: 5, kickers: ranks };
        }
        
        if (isStraight) {
            return { rank: 4, kickers: [straightHigh] };
        }
        
        if (isThree) {
            const threeRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 3));
            const kickers = ranks.filter(r => r !== threeRank);
            return { rank: 3, kickers: [threeRank, ...kickers] };
        }
        
        if (pairs >= 2) {
            const pairRanks = Object.keys(rankCounts)
                                .filter(r => rankCounts[r] === 2)
                                .map(r => parseInt(r))
                                .sort((a, b) => b - a);
            const kicker = ranks.find(r => !pairRanks.includes(r));
            return { rank: 2, kickers: [pairRanks[0], pairRanks[1], kicker] };
        }
        
        if (pairs === 1) {
            const pairRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 2));
            const kickers = ranks.filter(r => r !== pairRank);
            return { rank: 1, kickers: [pairRank, ...kickers] };
        }
        
        return { rank: 0, kickers: ranks };
    }

    compareScores(s1, s2) {
        if (s1.rank !== s2.rank) return s1.rank - s2.rank;
        for (let i = 0; i < s1.kickers.length; i++) {
            if (s1.kickers[i] !== s2.kickers[i]) {
                return s1.kickers[i] - s2.kickers[i];
            }
        }
        return 0;
    }

    getHandName(rank) {
        const names = [
            'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
            'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'
        ];
        return names[rank] || 'Unknown';
    }
}
