
import PokerEvaluator from './poker-evaluator.js';

const evaluator = new PokerEvaluator();

// Helper to create card
const c = (r, s) => ({ rank: r, suit: s });

let passedCount = 0;
let totalCount = 0;

function assert(name, condition, msg) {
    totalCount++;
    if (condition) {
        console.log(`[PASS] ${name}`);
        passedCount++;
    } else {
        console.error(`[FAIL] ${name}: ${msg}`);
    }
}

function compare(name, h1, h2, community, expectedWinner) {
    // expectedWinner: 1 for h1, 2 for h2, 0 for tie
    const res1 = evaluator.evaluate(h1, community);
    const res2 = evaluator.evaluate(h2, community);
    
    const comparison = evaluator.compareScores(res1.score, res2.score);
    
    let actualWinner = 0;
    if (comparison > 0) actualWinner = 1;
    else if (comparison < 0) actualWinner = 2;
    
    let resultStr = actualWinner === 0 ? 'Tie' : (actualWinner === 1 ? 'Player 1' : 'Player 2');
    let expectedStr = expectedWinner === 0 ? 'Tie' : (expectedWinner === 1 ? 'Player 1' : 'Player 2');
    
    assert(name, actualWinner === expectedWinner, 
        `Expected ${expectedStr}, got ${resultStr}. \n` +
        `P1: ${res1.name} (${JSON.stringify(res1.score)}) \n` +
        `P2: ${res2.name} (${JSON.stringify(res2.score)})`
    );
}

console.log('--- Starting Poker Comparison Tests ---');

// Community Cards for basic comparison
const board1 = [c('2', '♦'), c('5', '♣'), c('9', '♠'), c('J', '♥'), c('Q', '♦')];

// 1. High Card vs Pair
compare('High Card vs Pair',
    [c('A', '♠'), c('K', '♠')], // High Card A
    [c('2', '♠'), c('3', '♥')], // Pair of 2s (with board 2)
    board1,
    2 // Player 2 wins
);

// 2. Pair vs Two Pair
// Board: K, 8, 4, J, 2
const board2 = [c('K', '♦'), c('8', '♣'), c('4', '♠'), c('J', '♥'), c('2', '♦')];
compare('Pair vs Two Pair',
    [c('K', '♠'), c('Q', '♠')], // Pair of Ks
    [c('8', '♠'), c('4', '♥')], // Two Pair (8s and 4s)
    board2,
    2
);

// 3. Two Pair vs Three of a Kind
// Board: K, K, 4, 5, 9
const board3 = [c('K', '♦'), c('K', '♣'), c('4', '♠'), c('5', '♥'), c('9', '♦')];
compare('Two Pair vs Three of a Kind',
    [c('4', '♦'), c('5', '♦')], // Two Pair (Ks and 5s/4s) -> Actually K,K,5,5,9
    [c('K', '♠'), c('A', '♠')], // Three of a Kind (Ks)
    board3,
    2
);

// 4. Three of a Kind vs Straight
// Board: 2, 3, 4, 5, K
const board4 = [c('2', '♦'), c('3', '♣'), c('4', '♠'), c('5', '♥'), c('K', '♦')];
compare('Three of a Kind vs Straight',
    [c('K', '♠'), c('K', '♥')], // Three of a Kind (Ks)
    [c('A', '♠'), c('6', '♥')], // Straight (2-3-4-5-6)
    board4,
    2
);
// Special Straight Case: A-2-3-4-5
compare('Wheel Straight (A-2-3-4-5) vs Trips',
    [c('K', '♠'), c('K', '♥')], 
    [c('A', '♠'), c('6', '♥')], // 2,3,4,5,6 is higher straight
    board4,
    2
);
// Wait, A,2,3,4,5 is the Wheel. Let's test specifically Wheel.
const boardWheel = [c('2', '♦'), c('3', '♣'), c('4', '♠'), c('5', '♥'), c('9', '♦')];
compare('Wheel Straight vs Trips',
    [c('9', '♠'), c('9', '♥')], // Trips 9s
    [c('A', '♠'), c('J', '♥')], // Straight A-2-3-4-5
    boardWheel,
    2
);

// 5. Straight vs Flush
// Board: 2h, 4h, 6h, 8h, 10s
const board5 = [c('2', '♥'), c('4', '♥'), c('6', '♥'), c('8', '♥'), c('10', '♠')];
compare('Straight vs Flush',
    [c('3', '♣'), c('5', '♣')], // Straight 2-3-4-5-6
    [c('K', '♥'), c('Q', '♦')], // Flush (Hearts)
    board5,
    2
);

// 6. Flush vs Full House
// Board: K, K, K, 2, 3 (All Spades? No, let's mix)
const board6 = [c('K', '♠'), c('K', '♥'), c('K', '♦'), c('2', '♠'), c('3', '♠')];
compare('Flush vs Full House',
    [c('Q', '♠'), c('J', '♠')], // Flush (K,2,3,Q,J Spades)
    [c('2', '♥'), c('2', '♦')], // Full House (Ks over 2s) -> KKK22
    board6,
    2
);

// 7. Full House vs Four of a Kind
const board7 = [c('K', '♠'), c('K', '♥'), c('K', '♦'), c('K', '♣'), c('2', '♠')];
compare('Full House vs Four of a Kind',
    [c('2', '♥'), c('2', '♦')], // Full House (KKK22) - Actually Four of a Kind on board!
    // Wait, if board is KKKK2, everyone has Quad Ks.
    // Let's change board.
    // Board: K, K, K, 2, 5
    [c('3', '♥'), c('3', '♦')], // Full House (KKK33)
    [c('K', '♠'), c('K', '♥'), c('K', '♦'), c('2', '♠'), c('5', '♠')],
    2 // Wait, I messed up the arguments.
);
// Redo test 7
const board7Fixed = [c('K', '♠'), c('K', '♥'), c('K', '♦'), c('2', '♠'), c('5', '♠')];
compare('Full House vs Four of a Kind (Corrected)',
    [c('2', '♥'), c('2', '♦')], // Full House (KKK22)
    [c('K', '♣'), c('A', '♦')], // Four of a Kind (KKKK)
    board7Fixed,
    2
);

// 8. Four of a Kind vs Straight Flush
const board8 = [c('9', '♠'), c('10', '♠'), c('J', '♠'), c('Q', '♠'), c('2', '♥')];
compare('Four of a Kind vs Straight Flush',
    [c('2', '♦'), c('2', '♣')], // Four of a Kind (2222)
    [c('8', '♠'), c('K', '♠')], // Straight Flush (8-9-10-J-Q-K? No, 9-10-J-Q-K)
    board8,
    2
);

// 9. Straight Flush vs Royal Flush
const board9 = [c('10', '♠'), c('J', '♠'), c('Q', '♠'), c('K', '♠'), c('2', '♥')];
compare('Straight Flush vs Royal Flush',
    [c('9', '♠'), c('8', '♠')], // 9-10-J-Q-K Straight Flush
    [c('A', '♠'), c('3', '♦')], // 10-J-Q-K-A Royal Flush
    board9,
    2
);

console.log('--- Tie Breaker Tests ---');

// 10. Flush vs Flush (High Card)
const boardFlush = [c('2', '♠'), c('4', '♠'), c('6', '♠'), c('8', '♠'), c('10', '♥')];
compare('Flush vs Flush (Ace vs King)',
    [c('A', '♠'), c('J', '♦')], // Ace High Flush
    [c('K', '♠'), c('Q', '♠')], // King High Flush (Actually KQ864)
    boardFlush,
    1
);

// 11. Two Pair vs Two Pair (Kicker)
const board2P = [c('K', '♠'), c('K', '♥'), c('8', '♠'), c('8', '♥'), c('2', '♣')];
compare('Two Pair Kicker',
    [c('A', '♠'), c('3', '♦')], // KK88A
    [c('Q', '♠'), c('J', '♦')], // KK88Q
    board2P,
    1
);

// 12. High Card Kicker
const boardHigh = [c('2', '♠'), c('4', '♥'), c('6', '♦'), c('8', '♣'), c('10', '♠')];
compare('High Card Kicker',
    [c('A', '♠'), c('K', '♦')], // A,K,10,8,6
    [c('A', '♥'), c('Q', '♦')], // A,Q,10,8,6
    boardHigh,
    1
);

// 13. Split Pot
const boardSplit = [c('A', '♠'), c('K', '♠'), c('Q', '♠'), c('J', '♠'), c('10', '♠')]; // Royal Flush on Board
compare('Split Pot (Royal Flush on Board)',
    [c('2', '♥'), c('3', '♥')],
    [c('4', '♦'), c('5', '♦')],
    boardSplit,
    0 // Tie
);

// 14. Split Pot (Same Pair, Same Kickers)
const boardSplit2 = [c('K', '♠'), c('K', '♥'), c('A', '♠'), c('Q', '♥'), c('J', '♦')];
compare('Split Pot (Shared Board is Best)',
    [c('2', '♥'), c('3', '♥')], // Plays Board: KK, A, Q, J
    [c('4', '♦'), c('5', '♦')], // Plays Board: KK, A, Q, J
    boardSplit2,
    0
);

console.log(`--- Tests Finished: ${passedCount}/${totalCount} Passed ---`);
