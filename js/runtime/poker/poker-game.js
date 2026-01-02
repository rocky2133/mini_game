import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../../render';
import RoomManager from './room-manager';
import AIManager from '../ai-manager'; // Import AI Manager

export default class PokerGame {
    constructor() {
        this.room = null;
        this.userId = null;
        this.docId = null;

        this.backBtnX = 20;
        this.backBtnY = 80;
        this.backBtnRadius = 20;

        this.selectedSeatIndex = -1; // For host swapping seats
        this.avatarImages = {};
        this.showExitModal = false; // State for exit modal
    }
    
    init(room, userId, docId) {
        this.room = room;
        this.userId = userId;
        this.docId = docId;

        // Start watching for updates
        if (this.docId) {
            RoomManager.getInstance().listenToRoom(this.docId, (newRoom) => {
                if (newRoom) {
                    this.room = newRoom;
                    // Ensure cards are handled if they are plain objects
                    // (Rendering logic handles color property check)
                } else {
                    // Room deleted
                    wx.showToast({ title: 'Room closed', icon: 'none' });
                    this.quit();
                    // How to notify Main to switch back? 
                    // Usually we need a callback or Main checks status. 
                    // For now, let user click back.
                }
            });
        }
    }

    quit() {
        if (this.docId && this.userId) {
            RoomManager.getInstance().leaveRoom(this.docId, this.userId);
            RoomManager.getInstance().stopListening();
            this.room = null;
            this.userId = null;
            this.docId = null;
        }
    }

    preloadAvatars(players) {
        players.forEach(p => {
            if (p.avatarUrl && !this.avatarImages[p.avatarUrl]) {
                const img = wx.createImage();
                img.src = p.avatarUrl;
                this.avatarImages[p.avatarUrl] = { img, loaded: false };
                img.onload = () => {
                    if (this.avatarImages[p.avatarUrl]) {
                        this.avatarImages[p.avatarUrl].loaded = true;
                    }
                };
            }
        });
    }

    render(ctx) {
        // 1. Background
        // Dark Green #0F5132
        ctx.fillStyle = '#0F5132';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        
        // Simulated Radial Gradient Pattern (Dots)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        const dotGap = 20;
        for (let y = 0; y < SCREEN_HEIGHT; y += dotGap) {
            for (let x = 0; x < SCREEN_WIDTH; x += dotGap) {
                if ((x + y) % (dotGap * 2) === 0) { // Simple pattern
                     ctx.beginPath();
                     ctx.arc(x, y, 1, 0, Math.PI * 2);
                     ctx.fill();
                }
            }
        }
        
        // 2. Top Info Area (Gradient Header)
        const headerH = 80; // Min height from HTML
        const grad = ctx.createLinearGradient(0, 0, 0, headerH);
        grad.addColorStop(0, 'rgba(0,0,0,0.3)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, SCREEN_WIDTH, headerH);
        
        // Blind Info (Top Left)
        if (this.room) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            
            const sbVal = this.room.smallBlind || 100;
            const bbVal = this.room.bigBlind || 200;
            // Find SB/BB players if possible (logic might need adjustment if seat indices shift)
            // For now just show values
            const sbName = this.room.players[this.room.smallBlindIndex]?.name || 'SB';
            const bbName = this.room.players[(this.room.smallBlindIndex + 1) % this.room.players.length]?.name || 'BB';
            
            // Limit name length
            const safeName = (n) => n.length > 6 ? n.substring(0,6)+'..' : n;
            
            ctx.fillText(`SB: ${sbVal} - ${safeName(sbName)}`, 20, 44);
            ctx.fillText(`BB: ${bbVal} - ${safeName(bbName)}`, 20, 62);
        }
        
        // Exit Button (Top Right)
        const exitX = SCREEN_WIDTH - 20 - 15; // Right margin 20, radius 15
        const exitY = 54; // Centered roughly in top area
        const exitR = 15;
        
        this.backBtnX = exitX - exitR;
        this.backBtnY = exitY - exitR;
        this.backBtnRadius = exitR; // Actually radius, but touchHandler uses radius
        // Store center for touch
        this.exitBtnCenter = { x: exitX, y: exitY, r: exitR };

        ctx.fillStyle = 'rgba(220, 53, 69, 0.2)';
        ctx.strokeStyle = '#DC3545';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(exitX, exitY, exitR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#DC3545';
        ctx.font = 'bold 20px Arial'; // Larger X
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', exitX, exitY); // Use multiplication sign for better X
        ctx.textBaseline = 'alphabetic';

        if (!this.room) {
             ctx.fillStyle = '#fff';
             ctx.textAlign = 'center';
             ctx.fillText('Loading...', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        } else {
            // Game Render
            if (this.room.status === 'playing' || (this.room.game && this.room.game.stage === 'showdown')) {
                this.renderGame(ctx);
            } else {
                this.renderWaiting(ctx);
            }
        }
        
        // Exit Modal Overlay
        if (this.showExitModal) {
            this.renderExitModal(ctx);
        }
    }

    renderExitModal(ctx) {
        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        
        // Modal Box
        const w = 300;
        const h = 180;
        const x = (SCREEN_WIDTH - w) / 2;
        const y = (SCREEN_HEIGHT - h) / 2;
        
        ctx.fillStyle = '#FFFFFF';
        this.roundRect(ctx, x, y, w, h, 12, true);
        
        // Title
        ctx.fillStyle = '#333';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Leave Game?', x + w/2, y + 24);
        
        // Desc
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.fillText('Are you sure you want to leave?', x + w/2, y + 60);
        
        // Buttons
        const btnW = 120;
        const btnH = 40;
        const btnY = y + h - 24 - btnH;
        
        // Cancel (Left)
        const cancelX = x + 20;
        ctx.fillStyle = '#E9ECEF';
        this.roundRect(ctx, cancelX, btnY, btnW, btnH, 20, true);
        ctx.fillStyle = '#666';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Cancel', cancelX + btnW/2, btnY + btnH/2);
        
        // Confirm (Right)
        const confirmX = x + w - 20 - btnW;
        ctx.fillStyle = '#DC3545';
        this.roundRect(ctx, confirmX, btnY, btnW, btnH, 20, true);
        ctx.fillStyle = '#FFF';
        ctx.fillText('Leave', confirmX + btnW/2, btnY + btnH/2);
        
        ctx.textBaseline = 'alphabetic';
        
        // Store button coords for touch
        this.modalBtns = {
            cancel: { x: cancelX, y: btnY, w: btnW, h: btnH },
            confirm: { x: confirmX, y: btnY, w: btnW, h: btnH }
        };
    }

    renderWaiting(ctx) {
        // Grid Layout for Waiting Room
        const players = this.room.players;
        const meIndex = players.findIndex(p => p.id === this.userId);
        const me = players[meIndex];

        // Header Area is already partly drawn by render(), but let's add player count
        ctx.fillStyle = '#adb5bd';
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${players.length}/9 Players`, SCREEN_WIDTH - 20, 65);

        // Main Content Area: Grid
        const gridTop = 100;
        const gridW = SCREEN_WIDTH - 40;
        const colCount = 2;
        const cardW = 160;
        const cardH = 100;
        const gapX = (gridW - (colCount * cardW)) / (colCount - 1);
        const gapY = 15;

        // Center the grid horizontally
        const startX = 20;

        players.forEach((p, i) => {
            const col = i % colCount;
            const row = Math.floor(i / colCount);

            const x = startX + col * (cardW + gapX);
            const y = gridTop + row * (cardH + gapY);

            // Draw Player Card
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.roundRect(ctx, x, y, cardW, cardH, 8, true);

            // Host Badge
            if (p.isHost) {
                ctx.fillStyle = '#DC3545';
                this.roundRect(ctx, x - 5, y - 5, 30, 16, 4, true);
                ctx.fillStyle = '#FFF';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('HOST', x + 10, y + 3);
            }

            // Avatar
            const avR = 20;
            const avX = x + 30;
            const avY = y + cardH / 2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(avX, avY, avR, 0, Math.PI * 2);
            ctx.clip();
            // Draw Avatar Image or Placeholder
            if (p.avatarUrl && this.avatarImages[p.avatarUrl]?.loaded) {
                ctx.drawImage(this.avatarImages[p.avatarUrl].img, avX - avR, avY - avR, avR * 2, avR * 2);
            } else {
                ctx.fillStyle = '#ced4da';
                ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
            }
            ctx.restore();
            // Avatar Border
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(avX, avY, avR, 0, Math.PI * 2);
            ctx.stroke();

            // Name
            ctx.fillStyle = '#333';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(p.name.substring(0, 8), avX + avR + 10, y + 25);

            // Chips
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            this.roundRect(ctx, avX + avR + 10, y + 50, 60, 20, 10, true);
            ctx.fillStyle = '#FF7D00'; // Orange
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`$${p.chips}`, avX + avR + 10 + 30, y + 60);

            // Selection Highlight (for Host Swap)
            if (i === this.selectedSeatIndex) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                this.roundRect(ctx, x, y, cardW, cardH, 8, false, true);
            }
        });

        // Footer Area: Buttons
        const footerY = SCREEN_HEIGHT - 80;

        if (me && me.isHost) {
            const btnH = 44;
            const mainBtnW = SCREEN_WIDTH - 40;
            const halfBtnW = (mainBtnW - 10) / 2;

            // Top Row: Add/Remove Bot
            const subBtnY = footerY - 60;

            // Remove Bot
            ctx.fillStyle = 'rgba(220, 53, 69, 0.2)';
            ctx.strokeStyle = '#DC3545';
            this.roundRect(ctx, 20, subBtnY, halfBtnW, 40, 8, true, true);
            ctx.fillStyle = '#DC3545';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Remove Bot', 20 + halfBtnW / 2, subBtnY + 20);

            // Add Bot
            ctx.fillStyle = 'rgba(25, 135, 84, 0.2)';
            ctx.strokeStyle = '#198754';
            this.roundRect(ctx, 20 + halfBtnW + 10, subBtnY, halfBtnW, 40, 8, true, true);
            ctx.fillStyle = '#198754';
            ctx.fillText('Add Bot', 20 + halfBtnW + 10 + halfBtnW / 2, subBtnY + 20);

            // Start Game Button
            const canStart = players.length >= 2;
            ctx.fillStyle = canStart ? '#FF7D00' : '#6c757d';
            this.roundRect(ctx, 20, footerY, mainBtnW, btnH, 22, true);

            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 18px Arial';
            ctx.fillText('Start Game', SCREEN_WIDTH / 2, footerY + btnH / 2);

            ctx.textBaseline = 'alphabetic';
        } else {
            ctx.fillStyle = '#FFF';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for host to start...', SCREEN_WIDTH / 2, footerY + 20);
        }
    }

    renderGame(ctx) {
        // Layout Constants (Percentages)
        const LAYOUT = {
            TOP_BANNER: { h: 0.10, y: 0 },
            FAR_PLAYERS: { h: 0.20, y: 0.10 },
            BOARD: { h: 0.20, y: 0.30 },
            NEAR_PLAYERS: { h: 0.20, y: 0.50 },
            SELF_INFO: { h: 0.15, y: 0.70 },
            CONTROLS: { h: 0.15, y: 0.85 }
        };

        const getRect = (key) => ({
            x: 0,
            y: LAYOUT[key].y * SCREEN_HEIGHT,
            w: SCREEN_WIDTH,
            h: LAYOUT[key].h * SCREEN_HEIGHT
        });

        // 1. Top Banner
        this.renderTopBanner(ctx, getRect('TOP_BANNER'));

        // 2. Far Players (Upper Seat Area)
        this.renderFarPlayers(ctx, getRect('FAR_PLAYERS'));

        // 3. Board (Community Cards & Pot)
        this.renderBoard(ctx, getRect('BOARD'));

        // 4. Near Players (Lower Seat Area)
        this.renderNearPlayers(ctx, getRect('NEAR_PLAYERS'));

        // 5. Self Info (Player Card & Hand)
        this.renderSelfInfo(ctx, getRect('SELF_INFO'));

        // 6. Controls
        this.renderControls(ctx, getRect('CONTROLS'));

        // Showdown Overlay (Global Overlay)
        if (this.room.game && this.room.game.stage === 'showdown') {
            this.renderShowdownOverlay(ctx);
        }
    }

    renderTopBanner(ctx, rect) {
        const { x, y, w, h } = rect;
        
        // Gradient Background
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, 'rgba(0,0,0,0.5)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);

        if (this.room) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '14px Arial';
            
            const sbVal = this.room.smallBlind || 100;
            const bbVal = this.room.bigBlind || 200;
            const sbName = this.room.players[this.room.smallBlindIndex]?.name || 'SB';
            const bbName = this.room.players[(this.room.smallBlindIndex + 1) % this.room.players.length]?.name || 'BB';
            
            const safeName = (n) => n.length > 6 ? n.substring(0,6)+'..' : n;
            
            // Centered vertically in the top banner area
            const textY = y + h / 2;
            ctx.fillText(`SB: ${sbVal} - ${safeName(sbName)}`, x + 20, textY - 10);
            ctx.fillText(`BB: ${bbVal} - ${safeName(bbName)}`, x + 20, textY + 10);
        }

        // Exit Button (Top Right, Centered in Banner)
        const btnR = 15;
        const btnX = x + w - 20 - btnR;
        const btnY = y + h / 2;
        
        // Store for touch
        this.exitBtnCenter = { x: btnX, y: btnY, r: btnR };

        ctx.fillStyle = 'rgba(220, 53, 69, 0.2)';
        ctx.strokeStyle = '#DC3545';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#DC3545';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', btnX, btnY);
    }

    getRelativePlayers() {
        if (!this.room) return { me: null, others: [] };
        const players = this.room.players;
        const meIndex = players.findIndex(p => p.id === this.userId);
        if (meIndex === -1) return { me: null, others: players };
        
        // Rotate so me is at 0
        const rotated = [];
        for (let i = 0; i < players.length; i++) {
            rotated.push(players[(meIndex + i) % players.length]);
        }
        
        return {
            me: rotated[0],
            meOriginalIndex: meIndex,
            // others are rotated[1...n]
            others: rotated.slice(1).map((p, i) => ({
                player: p,
                originalIndex: (meIndex + 1 + i) % players.length
            }))
        };
    }

    renderFarPlayers(ctx, rect) {
        // Render players in the "Far" semi-circle (Top half of the table)
        // We have others array. 
        // Strategy: Divide others into Near (left/right of me) and Far (opposite).
        // Let's say with 9 players (1 me + 8 others):
        // 1,2 are Near Left. 7,8 are Near Right. 3,4,5,6 are Far.
        // Actually user said: "Far Players" -> "Distance larger"
        // "Near Players" -> "Distance closer"
        
        const { others } = this.getRelativePlayers();
        if (others.length === 0) return;

        // Simple Heuristic: 
        // If count <= 2 (Head-up or 3-max), all others are Far? Or split?
        // Let's just distribute strictly by index to fill the slots.
        // Far Area covers indices roughly in the middle of the 'others' array.
        
        // We will define specific slots in Far Area and Near Area.
        // Far Area: can hold up to 5 players?
        // Near Area: can hold up to 4 players (2 left, 2 right)?
        
        const count = others.length;
        // Split indices
        // e.g. 8 others: 0,1 (NearL), 2,3,4,5 (Far), 6,7 (NearR)
        // e.g. 1 other: 0 (Far - Heads up usually opposite)
        
        let farIndices = [];
        let nearIndices = [];

        if (count === 1) {
            farIndices = [0];
        } else if (count <= 4) {
             // 1 Near L, 1 Near R, rest Far
             // others[0] -> Near L
             // others[last] -> Near R
             // middle -> Far
             nearIndices.push(0);
             for(let i=1; i<count-1; i++) farIndices.push(i);
             nearIndices.push(count-1);
        } else {
             // 2 Near L, 2 Near R, rest Far
             nearIndices.push(0);
             nearIndices.push(1);
             for(let i=2; i<count-2; i++) farIndices.push(i);
             nearIndices.push(count-2);
             nearIndices.push(count-1);
        }

        // Render Far
        const slotW = rect.w / (farIndices.length + 1);
        const y = rect.y + rect.h / 2;
        
        farIndices.forEach((idx, i) => {
             const pObj = others[idx];
             const x = slotW * (i + 1);
             this.renderSeat(ctx, pObj.player, x, y, pObj.originalIndex, 0.8); // 0.8 scale
        });
        
        // Save near indices for next method
        this._nearIndices = nearIndices; 
        this._othersRef = others;
    }

    renderNearPlayers(ctx, rect) {
        const others = this._othersRef || [];
        const indices = this._nearIndices || [];
        if (indices.length === 0) return;

        // Split Left and Right
        // The first half of indices are Left, second half are Right (because of rotation order)
        // others array is clockwise from me.
        // so index 0, 1 are Immediate Left.
        // index last, last-1 are Immediate Right.
        
        // Actually, in the array others[0] is (Me + 1), which is to my LEFT.
        // others[last] is (Me - 1), which is to my RIGHT.
        
        const leftIndices = indices.filter(i => i < others.length / 2);
        const rightIndices = indices.filter(i => i >= others.length / 2);

        // Render Left (Top to Bottom or Bottom to Top?)
        // In "Near" area (20% height).
        // Let's just stack them vertically or horizontally depending on space.
        // Since it's a "Lower Half" arc.
        
        // Left Side
        const leftX = rect.w * 0.15;
        const rightX = rect.w * 0.85;
        
        // Distribute Y in the rect
        const stepY = rect.h / (Math.max(leftIndices.length, rightIndices.length) + 1);
        
        leftIndices.forEach((idx, i) => {
            const pObj = others[idx];
            // 0 is closest to me (Bottom of Left column?) or Top?
            // Standard poker table: 0 is immediate left.
            // Visually immediate left is usually bottom-left.
            // So we should render from bottom up? or top down?
            // Let's render top-down in the Near box, but logic says 0 is closest to me.
            // We'll put 0 at the bottom of the Near box (closest to Self Area).
            const y = rect.y + rect.h - stepY * (i + 1); 
            this.renderSeat(ctx, pObj.player, leftX, y, pObj.originalIndex, 0.9);
        });

        // Right Side (others[last] is immediate right)
        // So others[last] should be bottom-right.
        // others[last-1] above it.
        // rightIndices are like [6, 7] for 8 others. 7 is last.
        // We iterate reversed?
        const sortedRight = [...rightIndices].reverse(); // Now [7, 6]
        sortedRight.forEach((idx, i) => {
            const pObj = others[idx];
            const y = rect.y + rect.h - stepY * (i + 1);
            this.renderSeat(ctx, pObj.player, rightX, y, pObj.originalIndex, 0.9);
        });
    }

    renderBoard(ctx, rect) {
        // Community Cards & Pot
        const { x, y, w, h } = rect;
        
        // Pot
        const potValue = this.room.game?.pot || 0;
        const potY = y + h * 0.25;
        
        ctx.fillStyle = '#FF7D00';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${potValue}`, x + w / 2, potY);
        ctx.font = '10px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('POT', x + w / 2, potY + 18);

        // Cards (Fixed 5 positions)
        const cardW = 40; // Slightly smaller to fit
        const cardH = 56;
        const gap = 8;
        const totalW = 5 * cardW + 4 * gap;
        const startX = x + (w - totalW) / 2;
        const cardsY = y + h * 0.65 - cardH / 2;

        const community = this.room.game?.communityCards || [];
        
        for (let i = 0; i < 5; i++) {
            const cx = startX + i * (cardW + gap);
            if (i < community.length) {
                this.drawCard(ctx, community[i], cx, cardsY, cardW, cardH);
            } else {
                // Card Back / Placeholder
                this.drawCardBack(ctx, cx, cardsY, cardW, cardH);
            }
        }
    }

    renderSelfInfo(ctx, rect) {
        const { me } = this.getRelativePlayers();
        if (!me) return;

        const { x, y, w, h } = rect;
        
        // Avatar and Info
        // Centered
        const cx = x + w / 2;
        const cy = y + h / 2;
        
        // Large Avatar
        const avR = 30;
        const avX = cx - 60; // Left of center
        const avY = cy;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2);
        ctx.clip();
        if (me.avatarUrl && this.avatarImages[me.avatarUrl]?.loaded) {
            ctx.drawImage(this.avatarImages[me.avatarUrl].img, avX - avR, avY - avR, avR * 2, avR * 2);
        } else {
            ctx.fillStyle = '#ced4da';
            ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
        }
        ctx.restore();
        
        // Name & Chips
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(me.name.substring(0, 8), avX + avR + 10, avY - 10);
        ctx.fillStyle = '#FF7D00';
        ctx.fillText(`$${me.chips}`, avX + avR + 10, avY + 10);

        // Hand Cards (Large)
        if (me.hand) {
            const cardW = 50;
            const cardH = 70;
            // Position to the right of info? Or Overlay?
            // User said "Player Info Area: Info, Hand".
            // Let's put Hand to the right side of the screen or right of avatar?
            // Space is tight. Let's put Hand on the far right of this area.
            
            const handX = w - 20 - 2 * cardW - 5;
            const handY = cy - cardH / 2;
            
            this.drawCard(ctx, me.hand[0], handX, handY, cardW, cardH);
            this.drawCard(ctx, me.hand[1], handX + cardW + 5, handY, cardW, cardH);
        }

        // Active Highlight
        const meIndex = this.getRelativePlayers().meOriginalIndex;
        if (this.room.game && this.room.game.currentPlayerIndex === meIndex && this.room.game.stage !== 'showdown') {
             ctx.strokeStyle = '#FFD700';
             ctx.lineWidth = 3;
             ctx.strokeRect(x + 10, y + 5, w - 20, h - 10);
        }
    }

    renderControls(ctx, rect) {
        const { me, meOriginalIndex } = this.getRelativePlayers();
        if (!me) return;
        
        // Check if it's my turn
        if (!(this.room.game && this.room.game.currentPlayerIndex === meOriginalIndex && me.status === 'playing' && this.room.game.stage !== 'showdown')) {
            return;
        }

        const { x, y, w, h } = rect;
        const padding = 10;
        const btnH = h - 2 * padding; // Full height minus padding
        // Actually we need 2 rows maybe? or just 1 row with smaller buttons?
        // Old code had 2 rows. 
        // Let's try to fit in 1 row if possible, or 2 rows.
        // Area is 15% of screen. ample space.
        
        // Row 1: Check/Fold, Call/Check, Raise
        // Let's stick to the logic:
        // Fold, Call, Raise
        
        const btnCount = 3;
        const gap = 10;
        const btnW = (w - 2 * padding - (btnCount - 1) * gap) / btnCount;
        const btnY = y + padding;
        
        // Draw Buttons
        const labels = ['Fold', 'Call', 'Raise'];
        const colors = ['#6C757D', '#28A745', '#DC3545']; // Grey, Green, Red
        
        // Store control zones for touch
        this.controlZones = [];

        labels.forEach((label, i) => {
            const bx = x + padding + i * (btnW + gap);
            
            ctx.fillStyle = colors[i];
            this.roundRect(ctx, bx, btnY, btnW, btnH * 0.6, 8, true); // 60% height for button
            
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, bx + btnW / 2, btnY + btnH * 0.3);
            
            this.controlZones.push({ action: label.toLowerCase(), x: bx, y: btnY, w: btnW, h: btnH * 0.6 });
        });
        
        // Raise Slider/Input (Visual Only for now, mapped to Raise button logic)
        // Or render a second row for slider?
        // Simplified: Just 3 big buttons for now.
    }

    renderSeat(ctx, p, cx, cy, originalIndex, scale = 1.0) {
        // Generic Seat Renderer centered at cx, cy
        const w = 100 * scale;
        const h = 40 * scale;
        const x = cx - w / 2;
        const y = cy - h / 2;

        const isTurn = (this.room.game && this.room.game.currentPlayerIndex === originalIndex && this.room.game.stage !== 'showdown');

        // Background
        ctx.fillStyle = 'rgba(233, 236, 239, 0.9)';
        if (isTurn) {
            ctx.strokeStyle = '#FFC107';
            ctx.lineWidth = 2;
            this.roundRect(ctx, x, y, w, h, 6, true, true);
        } else {
            this.roundRect(ctx, x, y, w, h, 6, true, false);
        }

        // Avatar
        const avR = 15 * scale;
        const avX = x + 20 * scale;
        const avY = cy;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2);
        ctx.clip();
        if (p.avatarUrl && this.avatarImages[p.avatarUrl]?.loaded) {
            ctx.drawImage(this.avatarImages[p.avatarUrl].img, avX - avR, avY - avR, avR * 2, avR * 2);
        } else {
            ctx.fillStyle = '#ced4da';
            ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
        }
        ctx.restore();

        // Name & Chips
        ctx.fillStyle = '#212529';
        ctx.font = `${Math.floor(10 * scale)}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(p.name.substring(0, 6), avX + avR + 4, y + 4 * scale);
        
        ctx.fillStyle = '#FF7D00';
        ctx.fillText(`$${p.chips}`, avX + avR + 4, y + 20 * scale);

        // Last Action Pill
        if (p.lastAction) {
            const actW = 50 * scale;
            const actH = 14 * scale;
            const actX = cx - actW / 2;
            const actY = y - actH - 2;
            
            ctx.fillStyle = '#28A745';
            if (p.lastAction === 'fold') ctx.fillStyle = '#6C757D';
            if (p.lastAction === 'raise') ctx.fillStyle = '#DC3545';
            
            this.roundRect(ctx, actX, actY, actW, actH, 4, true);
            ctx.fillStyle = '#FFF';
            ctx.font = `bold ${Math.floor(8 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.lastAction.toUpperCase(), cx, actY + actH / 2);
        }
        
        // Bet Bubble
        if (p.bet > 0 && this.room.game && this.room.game.stage !== 'showdown') {
             ctx.fillStyle = '#FFD700';
             ctx.beginPath();
             ctx.arc(cx, y + h + 8 * scale, 8 * scale, 0, Math.PI * 2);
             ctx.fill();
             ctx.fillStyle = '#000';
             ctx.font = `${Math.floor(8 * scale)}px Arial`;
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText(p.bet, cx, y + h + 8 * scale);
        }

        // Dealer Button
        const sbIndex = this.room.smallBlindIndex;
        if (typeof sbIndex === 'number') {
            let dIndex = (sbIndex - 1 + this.room.players.length) % this.room.players.length;
            if (originalIndex === dIndex) {
                // Position Dealer Button (Top Left of seat?)
                const dX = x - 5;
                const dY = y - 5;
                ctx.fillStyle = '#FFF';
                ctx.beginPath();
                ctx.arc(dX, dY, 8 * scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = `bold ${Math.floor(10 * scale)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('D', dX, dY);
            }
        }

        // Cards (for Others)
        // Me is handled in renderSelfInfo, renderSeat is only for others
        const isShowdown = (this.room.game && this.room.game.stage === 'showdown' && p.status === 'playing');
        
        if (p.status === 'playing') {
            const cardW = 30 * scale; 
            const cardH = 42 * scale;
            const cardX = x + w + 5 * scale; // Right of seat
            const cardY = y + (h - cardH) / 2;

            if (isShowdown && p.hand) {
                this.drawCard(ctx, p.hand[0], cardX, cardY, cardW, cardH);
                this.drawCard(ctx, p.hand[1], cardX + cardW + 2 * scale, cardY, cardW, cardH);
            } else {
                // Back
                this.drawCardBack(ctx, cardX, cardY, cardW, cardH);
                this.drawCardBack(ctx, cardX + 10 * scale, cardY, cardW, cardH); // Stacked slightly
            }
        }
    }

    renderShowdownOverlay(ctx) {
        // Winners Info
        // Move Winners Info to Top Half to avoid blocking Me Cards and Community Cards
        let resultY = SCREEN_HEIGHT / 2 - 160;

        // Semi-transparent background for result
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        // Make background cover a band in the upper middle
        ctx.fillRect(0, resultY - 60, SCREEN_WIDTH, 220); // Increased height for AI comment

        // Draw AI Comment
        if (this.room.game.aiComment) {
            ctx.fillStyle = '#00FFFF'; // Cyan for AI
            ctx.font = 'italic 16px Arial';
            ctx.textAlign = 'center';
            // Word wrap simple implementation
            const words = this.room.game.aiComment.split(' ');
            let line = '';
            let commentY = resultY - 40;

            // Simple "AI says:" header
            ctx.fillText("🤖 AI Commentary:", SCREEN_WIDTH / 2, commentY - 20);

            // Draw text (simplified wrapping)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(this.room.game.aiComment, SCREEN_WIDTH / 2, commentY);
        }

        if (this.room.game.winners) {
            this.room.game.winners.forEach(w => {
                // Draw Trophy Icon
                const textX = SCREEN_WIDTH / 2;

                ctx.fillStyle = '#FFD700'; // Gold
                ctx.font = '30px Arial'; // Emoji size
                ctx.textAlign = 'center';
                ctx.fillText('🏆', textX, resultY - 30);

                ctx.fillStyle = '#00FF00';
                ctx.font = 'bold 22px Arial';
                ctx.textAlign = 'center';
                let winText = `${w.name} Wins! (+${this.room.game.pot})`;
                ctx.fillText(winText, textX, resultY);

                if (w.handResult) {
                    ctx.fillStyle = '#AAAAAA';
                    ctx.font = '18px Arial';
                    ctx.fillText(w.handResult.name, textX, resultY + 25);
                }
                resultY += 60;
            });
        }

        // Next Game Button (Host Only)
        const me = this.room.players.find(p => p.id === this.userId);
        if (me && me.isHost) {
            ctx.fillStyle = '#00FF00';
            this.roundRect(ctx, SCREEN_WIDTH / 2 - 60, SCREEN_HEIGHT - 120, 120, 40, 10);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Next Hand', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 100);
            ctx.textBaseline = 'alphabetic';
        } else {
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.fillText('Waiting for host...', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 100);
        }
    }

    drawCard(ctx, card, x, y, w, h) {
        // Card Background
        ctx.fillStyle = '#fff';
        this.roundRect(ctx, x, y, w, h, 6, true, false);

        // Gold Border
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, w, h, 6, false, true);

        const isRed = (card.suit === '♥' || card.suit === '♦');
        const color = isRed ? '#FF0000' : '#000000';
        const fontSize = Math.floor(w / 2); // Larger rank

        // Rank (Bottom)
        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(card.rank, x + w / 2, y + h - 5);

        // Suit (Top)
        const suitSize = Math.floor(w / 2.2);
        ctx.font = `${suitSize}px Arial`; // Normal font for emoji
        ctx.textBaseline = 'top';
        ctx.fillText(card.suit, x + w / 2, y + 5);

        ctx.textBaseline = 'alphabetic';
    }

    drawCardBack(ctx, x, y, w, h) {
        ctx.fillStyle = '#B22222';
        this.roundRect(ctx, x, y, w, h, 3, true, false);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    }

    roundRect(ctx, x, y, w, h, r, fill = true, stroke = false) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }

    update() {
        // Game loop
    }

    async touchHandler(x, y) {
        // 1. Exit Modal Handling (Priority)
        if (this.showExitModal && this.modalBtns) {
            // Cancel
            const btnC = this.modalBtns.cancel;
            if (x >= btnC.x && x <= btnC.x + btnC.w && y >= btnC.y && y <= btnC.y + btnC.h) {
                this.showExitModal = false;
                this.render(canvas.getContext('2d'));
                return 'cancel_exit';
            }
            // Confirm
            const btnL = this.modalBtns.confirm;
            if (x >= btnL.x && x <= btnL.x + btnL.w && y >= btnL.y && y <= btnL.y + btnL.h) {
                this.showExitModal = false;
                this.quit();
                return 'quit_game';
            }
            return null; // Consume touch
        }

        // 2. Back/Exit Button (Top Banner)
        if (this.exitBtnCenter) {
            const dx = x - this.exitBtnCenter.x;
            const dy = y - this.exitBtnCenter.y;
            // 2x radius tolerance
            if (dx*dx + dy*dy <= this.exitBtnCenter.r * this.exitBtnCenter.r * 4) { 
                this.showExitModal = true;
                this.render(canvas.getContext('2d'));
                return 'show_exit_modal';
            }
        }

        // 3. Showdown Handling (Priority)
        if (this.room && this.room.game && this.room.game.stage === 'showdown') {
            // Next Hand Button (Host Only)
            const me = this.room.players.find(p => p.id === this.userId);
            if (me && me.isHost) {
                // Button is rendered in renderShowdownOverlay at center bottom
                // x: SCREEN_WIDTH / 2 - 60, y: SCREEN_HEIGHT - 120, w: 120, h: 40
                const btnX = SCREEN_WIDTH / 2 - 60;
                const btnY = SCREEN_HEIGHT - 120;
                const btnW = 120;
                const btnH = 40;
                
                if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
                    console.log('[PokerGame] Clicked Return Room');
                    wx.showLoading({ title: 'Resetting...' });
                    const result = await RoomManager.getInstance().resetGame(this.docId);
                    wx.hideLoading();
                    if (!result.success) {
                        wx.showToast({ title: result.message, icon: 'none' });
                    } else {
                        this.room.status = 'waiting';
                        delete this.room.game; 
                        this.render(canvas.getContext('2d'));
                    }
                    return 'reset_game';
                }
            }
            return null;
        }

        // 4. Game Controls (Fold, Call, Raise)
        if (this.controlZones && this.controlZones.length > 0) {
            const meIndex = this.room.players.findIndex(p => p.id === this.userId);
            const me = this.room.players[meIndex];
            
            // Validate turn again just in case
            if (this.room.game && this.room.game.currentPlayerIndex === meIndex && me.status === 'playing') {
                 for (const zone of this.controlZones) {
                     if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
                         const action = zone.action;
                         if (action === 'fold') {
                             await RoomManager.getInstance().takeAction(this.docId, this.userId, 'fold');
                         } else if (action === 'call') {
                             await RoomManager.getInstance().takeAction(this.docId, this.userId, 'call');
                         } else if (action === 'raise') {
                             // Simple Raise for now (Min Raise or All-in logic needs refinement)
                             // For this demo, let's just raise double the bet or big blind
                             const currentBet = this.room.game.currentBet || 0;
                             const raiseAmt = Math.max((this.room.bigBlind || 200) * 2, currentBet * 2);
                             // Ensure we have enough chips
                             const finalRaise = Math.min(raiseAmt, me.chips);
                             await RoomManager.getInstance().takeAction(this.docId, this.userId, 'raise', finalRaise);
                         }
                         return 'game_action';
                     }
                 }
            }
        }
        
        // Waiting Room Logic (Start Game, Swap Seats)
        // Since we changed render logic, we need to adapt this if we want Waiting Room to work.
        // But user asked for "Game Page" layout.
        // If status is 'waiting', we use renderWaiting() which still uses Grid.
        // So we should keep the waiting room touch logic?
        // Yes, renderWaiting was NOT changed significantly (except it's in a separate method).
        // Let's copy back the waiting room logic from previous version or rewrite it simply.
        
        if (this.room && this.room.status === 'waiting') {
             // ... Re-implementing simplified waiting room touch logic ...
             // Check Start Game Button
             const meIndex = this.room.players.findIndex(p => p.id === this.userId);
             const me = this.room.players[meIndex];
             if (me && me.isHost) {
                 const footerY = SCREEN_HEIGHT - 80;
                 if (y >= footerY && y <= footerY + 44) {
                     wx.showLoading({ title: 'Starting...' });
                     await RoomManager.getInstance().startGame(this.docId, this.userId);
                     wx.hideLoading();
                     return 'start_game';
                 }
                 
                 // Add/Remove Bot (Sub buttons)
                 const subBtnY = footerY - 60;
                 if (y >= subBtnY && y <= subBtnY + 40) {
                     if (x < SCREEN_WIDTH / 2) {
                         await RoomManager.getInstance().removeBot(this.docId);
                     } else {
                         await RoomManager.getInstance().addBot(this.docId);
                     }
                     return 'bot_action';
                 }
             }
        }

        return null;
    }
}
