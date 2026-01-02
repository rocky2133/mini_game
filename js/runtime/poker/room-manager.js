import { Deck } from './poker-card.js';
import PokerEvaluator from './poker-evaluator.js';

import AIManager from '../ai-manager';

export default class RoomManager {
  constructor() {
    this.db = wx.cloud.database();
    this.rooms = this.db.collection('poker_rooms');
    this.watcher = null;
    this.evaluator = new PokerEvaluator();
  }

  static getInstance() {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  generateRoomId() {
    // For cloud, we trust the random ID collision is low or handled by create
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async getRoomByNumber(roomNumber) {
    const res = await this.rooms.where({
      roomId: roomNumber
    }).get();
    return (res.data && res.data.length > 0) ? res.data[0] : null;
  }

  async createRoom(userInfo, specificId = null) {
    const roomId = specificId || this.generateRoomId();
    
    // Check if exists
    const existing = await this.getRoomByNumber(roomId);
    if (existing) {
        return { success: false, message: 'Room already exists' };
    }
    
    // Parse userInfo
    const name = (typeof userInfo === 'string') ? userInfo : userInfo.name;
    const avatarUrl = (typeof userInfo === 'object') ? userInfo.avatarUrl : null;

    const hostId = 'user_' + Date.now();
    const room = {
      roomId: roomId,
      players: [{
        id: hostId,
        name: name,
        avatarUrl: avatarUrl,
        isHost: true,
        chips: 1000,
        status: 'ready',
        seatIndex: 0,
        avatarColor: this.getRandomColor()
      }],
      status: 'waiting',
      hostId: hostId,
      game: {},
      createTime: this.db.serverDate(),
      nextPlayerNumber: 2
    };

    try {
        const res = await this.rooms.add({ data: room });
        // res._id is the docId
        return { success: true, roomId: roomId, userId: hostId, room: room, docId: res._id };
    } catch (e) {
        console.error('Create Room Error:', e);
        return { success: false, message: 'Create failed: ' + e.message };
    }
  }

  async joinRoom(roomId, userInfo) {
    const room = await this.getRoomByNumber(roomId);
    if (!room) {
      return { success: false, message: 'Room not found' };
    }
    if (room.players.length >= 11) {
      return { success: false, message: 'Room is full' };
    }
    if (room.status === 'playing') {
      return { success: false, message: 'Game in progress' };
    }

    const userId = 'user_' + Date.now() + Math.floor(Math.random() * 1000);
    
    // Parse userInfo
    const name = (typeof userInfo === 'string') ? userInfo : userInfo.name;
    const avatarUrl = (typeof userInfo === 'object') ? userInfo.avatarUrl : null;

    // Determine player name based on nextPlayerNumber or fallback
    let playerName = name;
    let nextNum = room.nextPlayerNumber || (room.players.length + 1);
    if (!playerName) {
        playerName = `Player ${nextNum}`;
    }
    nextNum++;

    const newPlayer = {
      id: userId,
      name: playerName,
      avatarUrl: avatarUrl,
      isHost: false,
      chips: 1000,
      status: 'ready',
      seatIndex: room.players.length,
      avatarColor: this.getRandomColor()
    };

    const _ = this.db.command;
    try {
        const res = await this.rooms.doc(room._id).update({
            data: {
                players: _.push(newPlayer),
                nextPlayerNumber: nextNum
            }
        });

        if (res.stats && res.stats.updated === 0) {
             console.error('Join Room: No records updated. Check permissions.');
             return { success: false, message: 'Join failed: DB Update 0. Check Permissions.' };
        }

        room.players.push(newPlayer);
        return { success: true, roomId: roomId, userId: userId, room: room, docId: room._id };
    } catch (e) {
        console.error('Join Room Error:', e);
        // Check for permission error
        if (e.errCode === -502001) { // Database permission denied
             return { success: false, message: 'Permission Denied. Set DB perms to "All Read/Write"' };
        }
        return { success: false, message: 'Join failed: ' + e.message };
    }
  }

  async leaveRoom(docId, userId) {
    if (!docId) return;
    
    // We need to read the room to calculate new host
    try {
        const res = await this.rooms.doc(docId).get();
        const room = res.data;
        
        const playerIndex = room.players.findIndex(p => p.id === userId);
        if (playerIndex === -1) return;

        const wasHost = room.players[playerIndex].isHost;
        const newPlayers = room.players.filter(p => p.id !== userId);
        
        const hasRealPlayer = newPlayers.some(p => !p.isBot);
        
        if (!hasRealPlayer) {
            // Delete room if no real players left
            await this.rooms.doc(docId).remove();
        } else {
            let updates = {
                players: newPlayers
            };
            if (wasHost) {
                newPlayers[0].isHost = true;
                updates.hostId = newPlayers[0].id;
                // Need to update the specific player in the array or replace the array
                // Replacing array is easiest
            }
            await this.rooms.doc(docId).update({ data: updates });
        }
    } catch (e) {
        console.error('Leave room failed', e);
    }
  }

  async setPlayerAway(docId, userId, isAway) {
      try {
          const res = await this.rooms.doc(docId).get();
          const room = res.data;
          
          const players = room.players;
          const playerIndex = players.findIndex(p => p.id === userId);
          if (playerIndex === -1) return;
          
          players[playerIndex].isAway = isAway;
          
          // If setting to Away, and it's their turn, fold immediately
          const game = room.game;
          let shouldFold = false;
          if (isAway && game && game.status !== 'showdown' && game.currentPlayerIndex === playerIndex) {
               shouldFold = true;
          }
          
          await this.rooms.doc(docId).update({
              data: { players: players }
          });
          
          if (shouldFold) {
              await this.takeAction(docId, userId, 'fold');
          }
          
          return { success: true };
      } catch (e) {
          console.error('Set away error', e);
          return { success: false };
      }
  }

  async takeAction(docId, userId, action, amount = 0) {
    try {
        const res = await this.rooms.doc(docId).get();
        const room = res.data;
        
        if (!room.game) return { success: false, message: 'Game not started' };
        
        let players = room.players;
        let game = room.game;
        let currentPlayer = players[game.currentPlayerIndex];
        
        // Validate turn
        if (currentPlayer.id !== userId) return { success: false, message: 'Not your turn' };
        
        // Process Action
        currentPlayer.acted = true; // Mark that this player has acted in this round
        currentPlayer.lastAction = action; // Store the specific action for UI display

        // Initialize totalContribution if missing (legacy safety)
        if (typeof currentPlayer.totalContribution === 'undefined') {
            currentPlayer.totalContribution = 0;
        }

        if (action === 'fold') {
            currentPlayer.status = 'folded';
        } else if (action === 'call') {
            const currentBet = game.currentBet || 0;
            const playerBet = currentPlayer.bet || 0;
            const toCall = currentBet - playerBet;
            
            let amountCalled = 0;
            if (currentPlayer.chips < toCall) {
                // All-in
                amountCalled = currentPlayer.chips;
            } else {
                amountCalled = toCall;
            }

            game.pot += amountCalled;
            currentPlayer.chips -= amountCalled;
            currentPlayer.bet = (currentPlayer.bet || 0) + amountCalled;
            currentPlayer.totalContribution = (currentPlayer.totalContribution || 0) + amountCalled;
            
        } else if (action === 'raise') {
            const currentBet = game.currentBet || 0;
            const playerBet = currentPlayer.bet || 0;
            const toCall = currentBet - playerBet;
            
            // Validate Raise Amount
            // amount is the raise ON TOP of the call
            // Min raise: usually equal to the Big Blind or the previous raise increment.
            // Here we assume amount is valid from UI, but let's enforce min raise if possible.
            // For now, assume amount > 0.
            
            const totalBet = toCall + amount; 
            
            if (currentPlayer.chips < totalBet) {
                return { success: false, message: 'Not enough chips' };
            }
            
            game.pot += totalBet;
            currentPlayer.chips -= totalBet;
            currentPlayer.bet = currentBet + amount;
            currentPlayer.totalContribution = (currentPlayer.totalContribution || 0) + totalBet;
            
            game.currentBet = currentPlayer.bet;
            game.minRaise = amount; // Track min raise for next player? (Simplified)
            
            // Reset others' acted status because they need to respond to the raise
            players.forEach(p => {
                if (p.id !== userId && p.status === 'playing') {
                    p.acted = false;
                }
            });
        }
        
        // Move to next player
        let nextIndex = (game.currentPlayerIndex + 1) % players.length;
        let activePlayers = players.filter(p => p.status === 'playing');
        
        if (activePlayers.length === 1) {
            // Winner detected (everyone else folded)
            const winner = activePlayers[0];
            winner.chips += game.pot;
            
            // Calculate Round Changes
            players.forEach(p => {
                if (p.id === winner.id) {
                    p.roundChange = game.pot - (p.totalContribution || 0);
                } else {
                    p.roundChange = -(p.totalContribution || 0);
                }
            });

            game.stage = 'showdown';
            game.winner = winner;
            game.winReason = 'Others Folded';
            game.winners = [winner];
        } else {
            // Find next playing player
            // Skip non-playing players AND players with 0 chips (All-in)
            let loopCount = 0;
            while ((players[nextIndex].status !== 'playing' || players[nextIndex].chips === 0) && loopCount < players.length) {
                nextIndex = (nextIndex + 1) % players.length;
                loopCount++;
            }
            game.currentPlayerIndex = nextIndex;
            
            // Check if round should end
            // 1. All active players (with chips) have acted
            // 2. All active players have matched the current bet (or are all-in)
            const allActed = players
                .filter(p => p.status === 'playing' && p.chips > 0)
                .every(p => p.acted);
                
            const allMatched = players
                .filter(p => p.status === 'playing')
                .every(p => (p.bet || 0) === (game.currentBet || 0) || p.chips === 0);
                
            if (allActed && allMatched) { 
                 this.nextStage(docId, game, players);
            }
        }
        
        const _ = this.db.command;
        let updateData = {
            players: players,
            game: _.set(game)
        };

        // If game ended (Showdown), set status to waiting to allow joining/bot management
        if (game.stage === 'showdown') {
            updateData.status = 'waiting';
        }

        await this.rooms.doc(docId).update({
            data: updateData
        });

        // Trigger Bot or Away Player if next player is bot/away (Execute AFTER DB update)
        // We need to re-evaluate who is the current player because nextStage might have changed it
        const finalCurrentPlayer = players[game.currentPlayerIndex];
        if (finalCurrentPlayer && game.stage !== 'showdown') {
             if (finalCurrentPlayer.isBot) {
                 setTimeout(() => {
                     this.botAction(docId, finalCurrentPlayer.id);
                 }, 1000);
             } else if (finalCurrentPlayer.isAway) {
                 // Auto-fold for away player
                 setTimeout(() => {
                     this.takeAction(docId, finalCurrentPlayer.id, 'fold');
                 }, 1000);
             }
        }
        
        return { success: true };
    } catch (e) {
        console.error('Action error', e);
        return { success: false, message: 'Action failed' };
    }
  }

  async nextStage(docId, game, players) {
      // Pre-flop -> Flop -> Turn -> River -> Showdown
      const deck = new Deck(); // We need to reconstruct deck or save it better.
      // In startGame we saved deck as plain object.
      // Let's just pull from game.deck.cards
      
      const deal = (count) => {
          const cards = [];
          for(let i=0; i<count; i++) {
              if (game.deck.cards.length > 0) {
                  cards.push(game.deck.cards.shift());
              }
          }
          return cards;
      };
      
      if (game.stage === 'pre-flop') {
          game.stage = 'flop';
          game.communityCards = deal(3);
      } else if (game.stage === 'flop') {
          game.stage = 'turn';
          game.communityCards.push(...deal(1));
      } else if (game.stage === 'turn') {
          game.stage = 'river';
          game.communityCards.push(...deal(1));
      } else if (game.stage === 'river') {
          game.stage = 'showdown';
          // Determine winner logic
          const winners = this.determineWinners(game, players);
          
          // Split pot
          if (winners.length > 0) {
              const splitAmount = Math.floor(game.pot / winners.length);
              winners.forEach(w => {
                  w.chips += splitAmount;
                  w.winAmount = (w.winAmount || 0) + splitAmount;
              });
              // Handle remainder (give to first winner)
              const remainder = game.pot - (splitAmount * winners.length);
              if (remainder > 0) {
                  winners[0].chips += remainder;
                  winners[0].winAmount = (winners[0].winAmount || 0) + remainder;
              }
          }
          
          // Calculate Round Changes
          players.forEach(p => {
              p.roundChange = (p.winAmount || 0) - (p.totalContribution || 0);
              // Clean up temporary field
              delete p.winAmount;
          });
          
          game.winners = winners;
          // Trigger AI Comment
          this.triggerAIComment(docId, game, players);
      }
      
      // Reset bets for new round
      game.currentBet = 0;
      players.forEach(p => {
          p.bet = 0;
          // Don't reset totalContribution here! It persists for the whole hand (game).
          // But wait, totalContribution should accumulate for the hand.
          // Yes.
          if (p.status === 'playing') {
              p.acted = false;
              p.lastAction = '';
          }
      });
      
      // Reset player index to first active player after dealer (seat 0 for now)
      // Ideally should be small blind position, but let's just find first playing
      let nextIndex = 0;
      // Skip non-playing OR all-in players (0 chips) for acting
      while (nextIndex < players.length && (players[nextIndex].status !== 'playing' || players[nextIndex].chips === 0)) {
          nextIndex++;
      }
      game.currentPlayerIndex = nextIndex;

      // Check for Auto-Advance (All-in Scenario)
      // If active players > 1 AND (players with chips <= 1)
      // We skip betting and move to next stage immediately
      if (game.stage !== 'showdown') {
          const activePlayers = players.filter(p => p.status === 'playing');
          const canBetPlayers = activePlayers.filter(p => p.chips > 0);
          
          // If only 1 or 0 players can bet, no further betting is possible
          // (The one player cannot bet against themselves)
          if (activePlayers.length > 1 && canBetPlayers.length <= 1) {
               // Recursively call nextStage to fast-forward
               // This will execute immediately, mutating game/players
               // The final DB update in takeAction will reflect the final state
               this.nextStage(docId, game, players);
          }
      }

      // Trigger Bot if first player of new round is bot
      // Handled by takeAction's post-update trigger
  }

  triggerAIComment(docId, game, players) {
      if (game.winners && game.winners.length > 0) {
          const winner = game.winners[0];
          const losers = players.filter(p => p.status === 'playing' && !game.winners.includes(p));
          
          let prompt = `Game Result: Winner is ${winner.name} with ${winner.handResult ? winner.handResult.name : 'good hand'}. `;
          if (losers.length > 0) {
              const loser = losers[0];
              prompt += `Loser is ${loser.name} with ${loser.handResult ? loser.handResult.name : 'worse hand'}. `;
          }
          prompt += "Write a short, funny, sharp comment (1 sentence) about this result.";
          
          // Call AI Async
          AIManager.getInstance().generateGameComment(prompt).then(comment => {
              if (comment) {
                   // Update room with comment
                   this.rooms.doc(docId).update({
                       data: {
                           'game.aiComment': comment
                       }
                   });
              }
          });
      }
  }

  evaluateHand(hand, communityCards) {
      // Use the advanced PokerEvaluator
      return this.evaluator.evaluate(hand, communityCards);
  }

  determineWinners(game, players) {
      let activePlayers = players.filter(p => p.status === 'playing');
      let winners = [];
      let bestScore = null;
      
      activePlayers.forEach(p => {
          const result = this.evaluateHand(p.hand, game.communityCards);
          p.handResult = result;
          
          if (!bestScore) {
              bestScore = result.score;
              winners = [p];
          } else {
              const comparison = this.evaluator.compareScores(result.score, bestScore);
              if (comparison > 0) {
                  bestScore = result.score;
                  winners = [p];
              } else if (comparison === 0) {
                  winners.push(p);
              }
          }
      });
      
      return winners;
  }

  async resetGame(docId) {
    try {
        const res = await this.rooms.doc(docId).get();
        const room = res.data;
        
        const _ = this.db.command;
        
        // Reset players
        let players = room.players.map(p => {
            p.status = 'ready';
            p.hand = null;
            p.bet = 0;
            p.acted = false;
            p.lastAction = '';
            p.handResult = null;
            p.totalContribution = 0;
            return p;
        });

        // Filter out players who are bankrupt (0 chips) OR Away
        // "游戏结算时，筹码为0的玩家自动离开房间"
        // "若游戏结算时，玩家状态为离开，默认执行离开房间"
        const initialCount = players.length;
        players = players.filter(p => p.chips > 0 && !p.isAway);
        
        if (players.length < initialCount) {
             // Re-index seats if players removed?
             // Or just let them be removed. The startGame logic checks players.length >= 2.
             players.forEach((p, i) => p.seatIndex = i);
        }

        await this.rooms.doc(docId).update({
            data: {
                status: 'waiting',
                players: players,
                game: _.remove() // Remove game object
            }
        });
        
        return { success: true };
    } catch (e) {
        console.error('Reset Game Error', e);
        return { success: false, message: 'Reset failed' };
    }
  }

  async startGame(docId, hostId) {
    console.log('[RoomManager] startGame called', docId, hostId);
    try {
        const t1 = Date.now();
        const res = await this.rooms.doc(docId).get();
        console.log('[RoomManager] Room fetched', Date.now() - t1, 'ms');
        const room = res.data;
        
        if (room.hostId !== hostId) return { success: false, message: 'Only host can start' };
        if (room.players.length < 2) return { success: false, message: 'Not enough players (min 2)' }; // Changed to 2

        const deck = new Deck();
        deck.shuffle();
        
        // Deal 2 cards to each player
        const players = room.players.map(p => {
            p.status = 'playing';
            p.hand = [deck.deal(), deck.deal()];
            // Convert cards to plain objects to ensure they save correctly
            p.hand = p.hand.map(c => ({ suit: c.suit, rank: c.rank }));
            p.totalContribution = 0; // Initialize for new round
            return p;
        });

        // Determine Dealer Index (Button)
        let dealerIndex = 0;
        if (typeof room.dealerIndex === 'number') {
            // Next game, rotate clockwise
            dealerIndex = (room.dealerIndex + 1) % players.length;
        } else {
            // First game, random
            dealerIndex = Math.floor(Math.random() * players.length);
        }
        
        // Small Blind is next to Dealer
        let sbIndex = (dealerIndex + 1) % players.length;
        // Big Blind is next to SB
        let bbIndex = (dealerIndex + 2) % players.length;
        
        // Post Blinds
        const sbAmount = 10;
        const bbAmount = 20;
        
        // Ensure they have chips (simplified check)
        if (players[sbIndex].chips >= sbAmount) {
            players[sbIndex].chips -= sbAmount;
            players[sbIndex].bet = sbAmount;
            players[sbIndex].totalContribution = sbAmount;
            players[sbIndex].lastAction = 'SB';
        }
        
        if (players[bbIndex].chips >= bbAmount) {
            players[bbIndex].chips -= bbAmount;
            players[bbIndex].bet = bbAmount;
            players[bbIndex].totalContribution = bbAmount;
            players[bbIndex].lastAction = 'BB';
        }

        // Current Player (First Actor)
        // Pre-flop: Player to left of BB
        let currentPlayerIndex = (bbIndex + 1) % players.length;

        const game = {
            deck: { cards: deck.cards.map(c => ({ suit: c.suit, rank: c.rank })) },
            pot: sbAmount + bbAmount,
            currentBet: bbAmount,
            minRaise: bbAmount, // Initialize Min Raise
            communityCards: [],
            stage: 'pre-flop',
            currentPlayerIndex: currentPlayerIndex
        };

        const _ = this.db.command;
        const t2 = Date.now();
        await this.rooms.doc(docId).update({
            data: {
                status: 'playing',
                players: players,
                game: _.set(game),
                dealerIndex: dealerIndex,
                smallBlindIndex: sbIndex // Keep this for legacy or display reference if needed
            }
        });
        console.log('[RoomManager] Room updated', Date.now() - t2, 'ms');

        // Trigger Bot if first player is bot
        const firstPlayer = players[currentPlayerIndex];
        if (firstPlayer && firstPlayer.isBot) {
             setTimeout(() => {
                 this.botAction(docId, firstPlayer.id);
             }, 1000);
        }

        return { success: true };
    } catch (e) {
        console.error('[RoomManager] startGame Error', e);
        return { success: false, message: 'Start failed: ' + e.message };
    }
  }

  getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#F1948A', '#85C1E9', '#82E0AA'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async swapSeats(docId, userId, index1, index2) {
    try {
      const res = await this.rooms.doc(docId).get();
      const room = res.data;
      
      if (room.hostId !== userId) return { success: false, message: 'Only host can swap' };
      if (room.status !== 'waiting') return { success: false, message: 'Cannot swap during game' };
      
      if (index1 < 0 || index1 >= room.players.length || index2 < 0 || index2 >= room.players.length) {
        return { success: false, message: 'Invalid index' };
      }
      
      const players = [...room.players];
      const temp = players[index1];
      players[index1] = players[index2];
      players[index2] = temp;
      
      // Update seatIndex property
      players.forEach((p, i) => p.seatIndex = i);
      
      await this.rooms.doc(docId).update({
        data: { players: players }
      });
      
      return { success: true };
    } catch (e) {
      console.error('Swap error', e);
      return { success: false, message: 'Swap failed' };
    }
  }

  async botAction(docId, botId) {
      try {
          const res = await this.rooms.doc(docId).get();
          const room = res.data;
          
          if (!room.game || room.status !== 'playing') return;
          
          // Verify it's still bot's turn
          const currentPlayer = room.players[room.game.currentPlayerIndex];
          if (currentPlayer.id !== botId) return;
          
          // Logic
          const currentBet = room.game.currentBet || 0;
          const myBet = currentPlayer.bet || 0;
          const toCall = currentBet - myBet;
          
          let action = 'call';
          // Simple heuristic: Fold if toCall is high and random chance
          // For now, adhere to "only call or fold"
          // If Check (toCall == 0), always check (which is call)
          
          if (toCall > 0) {
              // 10% chance to fold if need to pay
              if (Math.random() < 0.1) action = 'fold';
          }
          
          console.log(`[Bot] ${currentPlayer.name} performs ${action}`);
          await this.takeAction(docId, botId, action);
          
      } catch (e) {
          console.error('Bot action failed', e);
      }
  }

  async addBot(docId) {
      try {
        const res = await this.rooms.doc(docId).get();
        const room = res.data;
        if (room.players.length >= 11) return { success: false, message: 'Room full' };
        
        const botId = 'bot_' + Date.now() + Math.floor(Math.random()*1000);
        const botNumber = room.players.filter(p => p.isBot).length + 1;
        const botName = `Bot ${botNumber}`;
        
        const botPlayer = {
            id: botId,
            name: botName,
            isBot: true,
            chips: 1000,
            status: 'ready',
            seatIndex: room.players.length,
            avatarColor: '#666666'
        };
        
        const _ = this.db.command;
        await this.rooms.doc(docId).update({
            data: { players: _.push(botPlayer) }
        });
        return { success: true };
      } catch (e) {
          console.error('Add Bot error', e);
          return { success: false, message: 'Add bot failed' };
      }
  }

  async removeBot(docId) {
      try {
        const res = await this.rooms.doc(docId).get();
        const room = res.data;
        
        const bots = room.players.filter(p => p.isBot);
        if (bots.length === 0) return { success: false, message: 'No bots' };
        
        const lastBot = bots[bots.length - 1];
        const newPlayers = room.players.filter(p => p.id !== lastBot.id);
        
        // Re-index seats
        newPlayers.forEach((p, i) => p.seatIndex = i);
        
        await this.rooms.doc(docId).update({
            data: { players: newPlayers }
        });
        return { success: true };
      } catch (e) {
          console.error('Remove Bot error', e);
          return { success: false, message: 'Remove bot failed' };
      }
  }



  listenToRoom(docId, callback) {
      if (this.watcher) this.watcher.close();
      this.watcher = this.rooms.doc(docId).watch({
          onChange: snapshot => {
              if (snapshot.docs && snapshot.docs.length > 0) {
                  callback(snapshot.docs[0]);
              } else {
                  // Room deleted?
                  callback(null);
              }
          },
          onError: err => console.error('Watch error', err)
      });
  }

  stopListening() {
      if (this.watcher) {
          this.watcher.close();
          this.watcher = null;
      }
  }
}
