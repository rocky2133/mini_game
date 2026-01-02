import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../../render';
import RoomManager from './room-manager';
import AIManager from '../ai-manager'; // Import AI Manager

const THEME = {
    colors: {
        bg: '#004d40', // Dark Green Felt
        bgInner: '#004d40',
        bgOuter: '#00251a',
        accent: '#FFC107', // Amber/Gold for Active Border
        primary: '#4CAF50', // Green (Call/Check)
        danger: '#F44336', // Red (All-in/Exit)
        warning: '#FF9800', // Orange (Raise/Pot)
        secondary: '#607D8B', // Blue Grey (Fold)
        text: '#FFFFFF',
        textSecondary: '#CFD8DC', // Light Blue Grey
        panelBg: '#B0BEC5', // Light Blue Grey for Player Cards
        panelBgDark: 'rgba(38, 50, 56, 0.85)', // Dark Blue Grey for Self/Folded
        chipBg: '#FF6F00', // Dark Amber for Chips Pill
        cardBack: '#3F51B5', // Indigo
        overlay: 'rgba(0,0,0,0.7)',
        placeholder: '#546E7A' // Blue Grey for empty slots
    },
    fonts: {
        xs: '10px Arial',
        sm: '12px Arial',
        md: 'bold 14px Arial',
        lg: 'bold 18px Arial',
        xl: 'bold 24px Arial',
        pot: 'bold 28px Arial'
    }
};

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
        
        // Raise UI State
        this.isRaising = false;
        this.raiseAmount = 0;

        // Scroll State
        this.resultScrollY = 0;
        this.maxScrollY = 0;
        this.lastTouchY = 0;
        this.isDragging = false;
    }
    
    init(room, userId, docId) {
        this.room = room;
        this.userId = userId;
        this.docId = docId;
        
        // Reset Scroll
        this.resultScrollY = 0;
        this.maxScrollY = 0;

        // Start watching for updates
        if (this.docId) {
            RoomManager.getInstance().listenToRoom(this.docId, (newRoom) => {
                if (newRoom) {
                    this.room = newRoom;
                    // Ensure avatars are preloaded when room updates (e.g. new players)
                    if (this.room.players) {
                        this.preloadAvatars(this.room.players);
                    }
                } else {
                    wx.showToast({ title: 'Room closed', icon: 'none' });
                    this.quit();
                }
            });
        }
        
        // Initial preload
        if (this.room && this.room.players) {
            this.preloadAvatars(this.room.players);
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

    handleAppHide() {
        if (this.docId && this.userId) {
            RoomManager.getInstance().setPlayerAway(this.docId, this.userId, true);
        }
    }

    handleAppShow() {
        if (this.docId && this.userId) {
            RoomManager.getInstance().setPlayerAway(this.docId, this.userId, false);
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
        // 1. Background (Radial Gradient)
        const cx = SCREEN_WIDTH / 2;
        const cy = SCREEN_HEIGHT / 2;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, SCREEN_HEIGHT * 0.8);
        gradient.addColorStop(0, THEME.colors.bgInner);
        gradient.addColorStop(1, THEME.colors.bgOuter);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        
        // Texture Pattern (Subtle dots)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        const dotGap = 30;
        for (let y = 0; y < SCREEN_HEIGHT; y += dotGap) {
            for (let x = 0; x < SCREEN_WIDTH; x += dotGap) {
                if ((x/dotGap + y/dotGap) % 2 === 0) { 
                     ctx.beginPath();
                     ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                     ctx.fill();
                }
            }
        }
        
        if (!this.room) {
             ctx.fillStyle = THEME.colors.text;
             ctx.textAlign = 'center';
             ctx.font = THEME.fonts.lg;
             ctx.fillText('Loading...', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        } else {
            // Game Render
            if (this.room.status === 'playing') {
                this.renderGame(ctx);
            } else if (this.room.game && this.room.game.stage === 'showdown') {
                this.renderResultPage(ctx);
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
        // Back Button (Top Left)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(this.backBtnX + this.backBtnRadius, this.backBtnY, this.backBtnRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('<', this.backBtnX + this.backBtnRadius, this.backBtnY);
        ctx.textBaseline = 'alphabetic';

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

    renderResultPage(ctx) {
        // Translation Map for Hand Types
        const HAND_TYPE_MAP = {
            'High Card': '高牌',
            'Pair': '对子',
            'Two Pair': '两对',
            'Three of a Kind': '三条',
            'Straight': '顺子',
            'Flush': '同花',
            'Full House': '葫芦',
            'Four of a Kind': '四条',
            'Straight Flush': '同花顺',
            'Royal Flush': '皇家同花顺'
        };

        // Start Scroll View
        ctx.save();
        ctx.translate(0, -this.resultScrollY);

        let currentY = 0;

        // 1. Header & Winner Section
        const winners = this.room.game.winners || [];
        const winner = winners[0]; // Primary winner

        // "本局赢家" Label
        currentY += 40;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('本局赢家', SCREEN_WIDTH / 2, currentY);

        // Winner Name
        currentY += 40;
        if (winner) {
            ctx.fillStyle = '#FFEB3B'; // Yellow
            ctx.font = 'bold 36px Arial';
            ctx.fillText(winner.name, SCREEN_WIDTH / 2, currentY);
            
            // Hand Type
            currentY += 30;
            ctx.fillStyle = '#FFEB3B'; // Yellow
            ctx.font = 'bold 18px Arial';
            const rawHandName = winner.handResult ? winner.handResult.name : '';
            const zhHandName = HAND_TYPE_MAP[rawHandName] || rawHandName;
            ctx.fillText(`牌型: ${zhHandName}`, SCREEN_WIDTH / 2, currentY);
        }

        // Winner's Best Hand
        currentY += 40;
        const communityCards = this.room.game.communityCards || [];
        const cardW = 40;
        const cardH = 56;
        const gap = 10;
        const totalW = communityCards.length * cardW + (communityCards.length - 1) * gap;
        let startX = (SCREEN_WIDTH - totalW) / 2;
        
        communityCards.forEach((c, i) => {
            this.renderSmallCard(ctx, c, startX + i * (cardW + gap), currentY, cardW, cardH);
        });
        
        currentY += cardH + 20;

        // 2. Player Hand Grid (2 Columns)
        const activePlayers = this.room.players.filter(p => p.status === 'playing' || (p.status === 'folded' && winners.some(w => w.id === p.id)));
        
        const gridX = 20;
        const gridW = SCREEN_WIDTH - 40;
        const colCount = 2;
        const colGap = 15;
        const rowGap = 15;
        const cellW = (gridW - (colCount - 1) * colGap) / colCount;
        const cellH = 140; // Increased height to prevent overlap
        
        activePlayers.forEach((p, i) => {
            const col = i % colCount;
            const row = Math.floor(i / colCount);
            
            const x = gridX + col * (cellW + colGap);
            const y = currentY + row * (cellH + rowGap);
            
            const isWinner = winners.some(w => w.id === p.id);
            const borderColor = isWinner ? '#FFEB3B' : 'rgba(255,255,255,0.1)';
            const bgColor = isWinner ? '#2E7D32' : '#1B5E20'; 
            
            // Box
            ctx.fillStyle = bgColor;
            this.roundRect(ctx, x, y, cellW, cellH, 12, true);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = isWinner ? 2 : 1;
            this.roundRect(ctx, x, y, cellW, cellH, 12, false, true);
            
            // Cards (Hole Cards) - Centered in box
            if (p.hand) {
                const pcW = 34;
                const pcH = 48;
                const pcGap = 6;
                const pcTotalW = 2 * pcW + pcGap;
                const pcX = x + (cellW - pcTotalW) / 2;
                const pcY = y + 15; // Top padding 15
                
                this.renderSmallCard(ctx, p.hand[0], pcX, pcY, pcW, pcH);
                this.renderSmallCard(ctx, p.hand[1], pcX + pcW + pcGap, pcY, pcW, pcH);
            }
            
            // Name - Below cards
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle'; 
            let name = p.name;
            if (p.id === this.userId) name += ' (我)';
            ctx.fillText(name, x + cellW / 2, y + 85); // Increased Y offset
            
            // Hand Type Badge - Bottom
            if (p.handResult) {
                const badgeH = 20; // Slightly taller
                const rawName = p.handResult.name;
                const zhName = HAND_TYPE_MAP[rawName] || rawName;
                
                ctx.font = 'bold 11px Arial';
                const tm = ctx.measureText(zhName);
                const badgeW = tm.width + 16;
                const badgeX = x + (cellW - badgeW) / 2;
                // Place at bottom with padding
                const badgeYInside = y + cellH - badgeH - 10;

                ctx.fillStyle = isWinner ? '#FFC107' : '#CFD8DC'; 
                this.roundRect(ctx, badgeX, badgeYInside, badgeW, badgeH, 6, true);
                
                ctx.fillStyle = '#000';
                ctx.textBaseline = 'middle';
                ctx.fillText(zhName, badgeX + badgeW / 2, badgeYInside + badgeH / 2);
            }
        });
        
        // Update currentY after grid
        const rowCount = Math.ceil(activePlayers.length / colCount);
        currentY += rowCount * (cellH + rowGap) + 20;

        // 3. Chip Changes List
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#CFD8DC';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('筹码变动', 20, currentY);
        currentY += 10;
        
        // Sort players by chips won (descending)
        const sortedPlayers = [...this.room.players].sort((a, b) => {
             const changeA = a.roundChange || 0;
             const changeB = b.roundChange || 0;
             return changeB - changeA;
        });
        
        const rowH = 50;
        
        sortedPlayers.forEach((p, i) => {
            // Render all rows, let user scroll
            const rowY = currentY;
            
            // Background Row
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.roundRect(ctx, 20, rowY, SCREEN_WIDTH - 40, rowH - 6, 8, true);
            
            // Avatar
            const avR = 16;
            const avX = 45;
            const avY = rowY + (rowH - 6)/2;
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(avX, avY, avR, 0, Math.PI*2);
            ctx.clip();
            if (p.avatarUrl && this.avatarImages[p.avatarUrl]?.loaded) {
                ctx.drawImage(this.avatarImages[p.avatarUrl].img, avX - avR, avY - avR, avR * 2, avR * 2);
            } else {
                ctx.fillStyle = '#B0BEC5';
                ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
            }
            ctx.restore();
            
            // Name
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.name, avX + 25, avY);
            
            // Amount
            const change = p.roundChange || 0;
            const changeStr = change > 0 ? `+${change}` : `${change}`;
            ctx.fillStyle = change >= 0 ? '#4CAF50' : '#F44336';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(changeStr, SCREEN_WIDTH - 40, avY - 8);
            
            // Balance
            ctx.fillStyle = '#90A4AE';
            ctx.font = '12px Arial';
            ctx.fillText(`余额: ${p.chips}`, SCREEN_WIDTH - 40, avY + 10);
            
            currentY += rowH;
        });

        // Update Max Scroll
        // Allow scrolling so last item clears the fixed footer button (approx 120px)
        const totalHeight = currentY + 120;
        this.maxScrollY = Math.max(0, totalHeight - SCREEN_HEIGHT);

        ctx.restore(); // Restore to render fixed elements
        
        // 5. Scrollbar (Visual Indicator)
        if (this.maxScrollY > 0) {
            const barW = 4;
            const barH = Math.max(40, (SCREEN_HEIGHT / totalHeight) * SCREEN_HEIGHT);
            const barX = SCREEN_WIDTH - barW - 2;
            const barY = (this.resultScrollY / totalHeight) * SCREEN_HEIGHT;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.roundRect(ctx, barX, barY, barW, barH, 2, true);
        }

        // 4. Footer Button (Floating) - Host Only
        const me = this.room.players.find(p => p.id === this.userId);
        if (me && me.isHost) {
            const btnW = 220;
            const btnH = 50;
            const btnX = (SCREEN_WIDTH - btnW) / 2;
            const btnY = SCREEN_HEIGHT - 80; 
            
            // Shadow for button
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;
            
            ctx.fillStyle = '#FF9800'; // Orange
            this.roundRect(ctx, btnX, btnY, btnW, btnH, 25, true);
            ctx.restore();
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('下一局 (Next Game)', SCREEN_WIDTH / 2, btnY + btnH / 2);
            
            // Store button hit area (Fixed Coords)
            this.resultBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
        } else {
            // Non-host: Waiting text
            ctx.fillStyle = '#B0BEC5';
            ctx.font = 'italic 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('等待房主开始下一局...', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 60);
            this.resultBtn = null;
        }

        // Back Button (Top Left)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(this.backBtnX + this.backBtnRadius, this.backBtnY, this.backBtnRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('<', this.backBtnX + this.backBtnRadius, this.backBtnY);
        ctx.textBaseline = 'alphabetic';
    }

    renderSmallCard(ctx, card, x, y, w, h) {
        // Render card background
        ctx.fillStyle = '#FFFFFF';
        this.roundRect(ctx, x, y, w, h, 6, true);
        
        if (!card) return;
        
        // Unicode Suit Logic
        const suit = card.suit;
        const rank = card.rank;
        
        let color = '#000';
        if (suit === '♥' || suit === '♦') {
            color = '#D32F2F'; // Red
        } else {
            color = '#212121'; // Black
        }
        
        ctx.fillStyle = color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Layout: Rank top, Suit bottom
        // Center content vertically
        const centerY = y + h / 2;
        
        // Rank
        ctx.font = 'bold 16px Arial';
        ctx.fillText(rank, x + w / 2, centerY - 8);
        
        // Suit
        ctx.font = '20px Arial';
        ctx.fillText(suit, x + w / 2, centerY + 10);
    }

    renderTopBanner(ctx, rect) {
        const { x, y, w, h } = rect;
        
        // No Gradient Background - Clean look like reference
        // Just minimal top bar overlay if needed, or fully transparent
        // ctx.fillStyle = 'rgba(0,0,0,0.2)';
        // ctx.fillRect(x, y, w, h);

        // 1. Room Info (Top Left)
        if (this.room) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            const startX = x + 20;
            const startY = y + 15;
            const lineHeight = 20;
            
            // Fix: Match actual values from RoomManager (10/20) if not set in room
            const sbVal = this.room.smallBlind || 10;
            const bbVal = this.room.bigBlind || 20;
            
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = THEME.colors.text;
            ctx.fillText(`SB: ${sbVal}`, startX, startY);
            ctx.fillText(`BB: ${bbVal}`, startX, startY + lineHeight);
        }

        // 2. Exit Button (Top Right)
        const btnR = 16;
        const btnX = x + w - 30;
        const btnY = y + 30; // Roughly aligned with info
        
        this.exitBtnCenter = { x: btnX, y: btnY, r: btnR };

        // Button Background (Red Circle with low opacity or solid?)
        // Reference image has a dark circle with Red X, or Red Circle with White X?
        // Let's do Red Circle (muted) with White X
        ctx.fillStyle = 'rgba(244, 67, 54, 0.8)'; // Red
        ctx.beginPath();
        ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon (X)
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const iconSize = 6;
        ctx.moveTo(btnX - iconSize, btnY - iconSize);
        ctx.lineTo(btnX + iconSize, btnY + iconSize);
        ctx.moveTo(btnX + iconSize, btnY - iconSize);
        ctx.lineTo(btnX - iconSize, btnY + iconSize);
        ctx.stroke();
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
        // Dynamic Player Distribution Rule:
        // Total Players (N) -> Others (N-1)
        // N=6 (5 others): 3 Top, 2 Bottom
        // N=5 (4 others): 2 Top, 2 Bottom
        // N=4 (3 others): 1 Top, 2 Bottom
        // N=3 (2 others): 2 Top, 0 Bottom
        // N=2 (1 other):  1 Top, 0 Bottom
        
        const { others } = this.getRelativePlayers();
        if (others.length === 0) return;

        let farIndices = [];
        let nearIndices = [];
        
        const totalPlayers = this.room.players.length; 
        
        if (totalPlayers <= 3) {
            farIndices = others.map((_, i) => i);
            nearIndices = [];
        } else {
            nearIndices.push(0); // First (Left)
            for (let i = 1; i < others.length - 1; i++) {
                farIndices.push(i); // Middle (Top)
            }
            nearIndices.push(others.length - 1); // Last (Right)
        }

        // Render Far Players (Top Area)
        // User says: "Distance between player sub-blocks as large as possible, evenly distributed."
        // Update: Width increased to 25%
        const blockW = SCREEN_WIDTH * 0.25;
        const blockH = SCREEN_HEIGHT * 0.10;
        const y = rect.y + (rect.h - blockH) / 2; // Vertically center
        
        const count = farIndices.length;
        if (count === 0) {
            // No top players
        } else if (count === 1) {
            // Center single player
            const x = rect.x + (rect.w - blockW) / 2;
            const pObj = others[farIndices[0]];
            this.renderPlayerBlock(ctx, pObj.player, x, y, blockW, blockH, pObj.originalIndex);
        } else {
            // Distribute evenly across the width
            // Margins: 10px from edges
            const margin = 10;
            const availableW = rect.w - 2 * margin - blockW; // Width from first start to last start
            const step = availableW / (count - 1);
            
            farIndices.forEach((idx, i) => {
                const pObj = others[idx];
                const x = rect.x + margin + i * step;
                this.renderPlayerBlock(ctx, pObj.player, x, y, blockW, blockH, pObj.originalIndex);
            });
        }
        
        // Save near indices for next method
        this._nearIndices = nearIndices; 
        this._othersRef = others;
    }

    renderNearPlayers(ctx, rect) {
        const others = this._othersRef || [];
        const indices = this._nearIndices || [];
        if (indices.length === 0) return;

        // Render Near Players (Bottom Area)
        // Indices usually [0, last]
        // 0 is Left (Near Left)
        // last is Right (Near Right)
        
        const blockW = SCREEN_WIDTH * 0.25;
        const blockH = SCREEN_HEIGHT * 0.10;
        
        // Left Side: 0
        // Right Side: last
        
        // If we have 2 near players:
        // One at Left (margin), One at Right (margin)
        
        // If we only have 1 near player (shouldn't happen with current logic for N>=4, but robust check)
        
        const leftIndex = indices[0]; // The first one is definitely Left
        // If indices.length > 1, the last one is Right.
        
        const y = rect.y + (rect.h - blockH) / 2;
        
        // Left Position
        // Align to left with some margin
        const leftX = rect.x + 10;
        if (leftIndex !== undefined) {
             const pObj = others[leftIndex];
             this.renderPlayerBlock(ctx, pObj.player, leftX, y, blockW, blockH, pObj.originalIndex);
        }
        
        // Right Position
        // Align to right
        if (indices.length > 1) {
            const rightIndex = indices[indices.length - 1];
            const rightX = rect.x + rect.w - blockW - 10;
            const pObj = others[rightIndex];
            this.renderPlayerBlock(ctx, pObj.player, rightX, y, blockW, blockH, pObj.originalIndex);
        }
    }

    renderPlayerBlock(ctx, p, x, y, w, h, originalIndex) {
        // Design Specs (Refined):
        // - Rounded Rect Card Background
        // - Active Border (Yellow)
        // - Status Badges (Top Right, inside block)
        // - Chips Pill (Orange)
        
        const cx = x + w / 2;
        const cy = y + h / 2;
        const isCurrent = (this.room.game && this.room.game.currentPlayerIndex === originalIndex);
        const isFolded = (p.status === 'folded');

        // 1. Card Background
        ctx.save();
        
        if (isFolded) {
             ctx.fillStyle = 'rgba(38, 50, 56, 0.6)'; // Darker, transparent
        } else {
             ctx.fillStyle = THEME.colors.panelBg; // Light Blue Grey
        }
        
        // Shadow for depth
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;
        
        this.roundRect(ctx, x, y, w, h, 12, true, false);
        ctx.shadowBlur = 0; // Reset shadow
        ctx.shadowOffsetY = 0;

        // 2. Active Border (Yellow)
        if (isCurrent) {
            ctx.strokeStyle = THEME.colors.accent;
            ctx.lineWidth = 3;
            this.roundRect(ctx, x, y, w, h, 12, false, true);
        }
        ctx.restore();

        // Internal Layout Calculation to avoid overlap
        // Maximize elements
        // h is small (10% height)
        // With 25% width, we have horizontal space, but height is constraint.
        
        const pillH = 22; // Increased from 18
        const nameH = 18; // Increased from 16
        const paddingY = 2; // Decreased padding
        const gap = 0;
        
        // Bottom Up Layout
        const pillY = y + h - pillH - paddingY;
        const nameY = pillY - nameH - gap; 
        
        // Remaining space for avatar
        const avBottom = nameY - gap;
        const avTop = y + paddingY;
        const maxAvH = avBottom - avTop;
        
        // Maximize Avatar Radius, but keep it within vertical bounds
        // And check horizontal bounds if needed (rarely an issue with 25% width)
        const avR = Math.min(maxAvH / 2, h * 0.35); // Cap at 35% height (was 25%)
        const avY = avTop + maxAvH / 2; // Center in available space
        
        // 3. Avatar (Top Center)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, avY, avR, 0, Math.PI * 2);
        ctx.clip();
        
        if (p.avatarUrl && this.avatarImages[p.avatarUrl]?.loaded) {
            ctx.drawImage(this.avatarImages[p.avatarUrl].img, cx - avR, avY - avR, avR * 2, avR * 2);
        } else {
            // Placeholder Color Circle
            ctx.fillStyle = '#78909C'; // Grey Blue
            ctx.fillRect(cx - avR, avY - avR, avR * 2, avR * 2);
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.floor(avR)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.name.charAt(0).toUpperCase(), cx, avY);
        }
        ctx.restore();
        
        // Avatar Border (White)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, avY, avR, 0, Math.PI * 2);
        ctx.stroke();
        
        // Folded Overlay on Avatar
        if (isFolded) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.arc(cx, avY, avR, 0, Math.PI * 2);
            ctx.fill();
        }

        // 4. Name (Below Avatar)
        ctx.fillStyle = '#37474F'; // Dark Text
        ctx.font = 'bold 14px Arial'; // Increased from 13
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; 
        // Allow slightly longer names with 25% width
        const safeName = p.name.length > 10 ? p.name.substring(0, 8) + '..' : p.name;
        ctx.fillText(safeName, cx, nameY + nameH/2);

        // 5. Chips Pill (Orange)
        const chipVal = `${p.chips >= 1000 ? (p.chips/1000).toFixed(1) + 'k' : p.chips}`;
        ctx.font = 'bold 13px Arial'; // Increased from 12
        const tm = ctx.measureText(chipVal);
        const pillW = tm.width + 18;
        const pillX = cx - pillW / 2;
        
        ctx.fillStyle = THEME.colors.chipBg; // Orange
        this.roundRect(ctx, pillX, pillY, pillW, pillH, 9, true);
        
        ctx.fillStyle = '#3E2723'; // Dark Brown Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(chipVal, cx, pillY + pillH/2);

        // 6. Dealer Button (Top Left)
         const sbIndex = this.room.smallBlindIndex;
        if (typeof sbIndex === 'number') {
            let dIndex = (sbIndex - 1 + this.room.players.length) % this.room.players.length;
            if (originalIndex === dIndex) {
                const dR = 8; // Slightly larger
                const dX = x + 4; // Inside
                const dY = y + 4; 
                
                // Draw partially overlapping top-left
                // Or inside? Let's put it on the corner
                
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(dX, dY, dR, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = '#ccc';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                ctx.fillStyle = '#000';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('D', dX, dY);
            }
        }
        
        // 7. Small Cards (if Showdown)
        if (p.status === 'playing' && !isFolded && this.room.game && this.room.game.stage === 'showdown' && p.hand) {
             const cW = 20; // Larger
             const cH = 28;
             const cY = y + h - cH - 4;
             const cX = x + w - cW * 2 - 4;
             
             this.drawCard(ctx, p.hand[0], cX, cY, cW, cH);
             this.drawCard(ctx, p.hand[1], cX + cW + 2, cY, cW, cH);
        }
        
        // 8. Status Badge (Top Right Corner - Inside Block) - Draw LAST
        // Priority: All-in > Folded > Action > Acting
        let badgeText = '';
        let badgeColor = THEME.colors.secondary; // Default Grey
        
        const isAllIn = (p.status === 'playing' && p.chips === 0);
        
        if (p.status === 'folded') {
            badgeText = '弃牌';
            badgeColor = THEME.colors.secondary;
        } else if (isAllIn) {
            badgeText = '全下';
            badgeColor = THEME.colors.danger;
        } else if (p.lastAction) {
            // Map actions to Chinese
            const actionMap = {
                'check': '过牌',
                'call': '跟注',
                'raise': '加注',
                'bet': '下注',
                'fold': '弃牌'
                // SB/BB hidden as per request
            };
            
            // Only show if in map (skip SB/BB)
            if (actionMap[p.lastAction]) {
                badgeText = actionMap[p.lastAction];
                
                if (p.lastAction === 'raise' || p.lastAction === 'bet') badgeColor = THEME.colors.warning;
                else if (p.lastAction === 'call' || p.lastAction === 'check') badgeColor = THEME.colors.primary;
            }
        } else {
            // No recent action - Do not show SB/BB labels
        }
        
        if (isCurrent && !badgeText) {
            // Fallback for current player if no SB/BB/Action
            badgeText = '思考中';
            badgeColor = THEME.colors.accent;
        } else if (isCurrent) {
            // If current but has badge (e.g. SB), maybe add indicator? 
            // Or just rely on the Yellow Border of the block.
            // The Yellow Border (renderPlayerBlock top) already indicates turn.
        }
        
        if (badgeText) {
             ctx.font = 'bold 11px Arial';
             const bTm = ctx.measureText(badgeText);
             const badgeW = bTm.width + 10;
             const badgeH = 18;
             // Align top right, inside padding
             const badgeX = x + w - badgeW - 2; 
             const badgeY = y + 2;
             
             ctx.shadowColor = 'rgba(0,0,0,0.2)';
             ctx.shadowBlur = 4;
             
             ctx.fillStyle = badgeColor;
             this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6, true);
             
             ctx.shadowBlur = 0;
             
             ctx.fillStyle = '#fff';
             if (badgeColor === THEME.colors.accent) ctx.fillStyle = '#3E2723'; 
             
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText(badgeText, badgeX + badgeW/2, badgeY + badgeH/2);
        }
    }

    renderBoard(ctx, rect) {
        const { x, y, w, h } = rect;
        
        // Center Pot Info
        const potY = y + h * 0.2;
        
        if (this.room.game) {
            // Pot Pill
            const potVal = this.room.game.pot || 0;
            const text = `POT: $${potVal}`;
            ctx.font = 'bold 16px Arial';
            const tm = ctx.measureText(text);
            const pillW = tm.width + 40;
            const pillH = 30;
            const pillX = x + (w - pillW) / 2;
            
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.roundRect(ctx, pillX, potY, pillW, pillH, 15, true);
            
            ctx.fillStyle = THEME.colors.accent;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x + w / 2, potY + pillH / 2);

            // Community Cards
            const cards = this.room.game.communityCards || [];
            const cardW = 40;
            const cardH = 56;
            const gap = 8;
            const totalW = 5 * cardW + 4 * gap;
            const startX = x + (w - totalW) / 2;
            const cardY = potY + 40; // Below Pot

            for (let i = 0; i < 5; i++) {
                const cx = startX + i * (cardW + gap);
                if (i < cards.length) {
                    this.drawCard(ctx, cards[i], cx, cardY, cardW, cardH);
                } else {
                    // Empty slot or card back placeholder? 
                    // Usually empty slots are just outlines or subtle
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    this.roundRect(ctx, cx, cardY, cardW, cardH, 4, true);
                    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                    ctx.lineWidth = 1;
                    this.roundRect(ctx, cx, cardY, cardW, cardH, 4, false, true);
                }
            }
        }
    }

    renderSelfInfo(ctx, rect) {
        const { x, y, w, h } = rect;
        const meIndex = this.room.players.findIndex(p => p.id === this.userId);
        if (meIndex === -1) return;
        const me = this.room.players[meIndex];
        const isCurrent = (this.room.game && this.room.game.currentPlayerIndex === meIndex);

        // Panel Background
        const panelW = w * 0.95;
        const panelH = h * 0.85;
        const panelX = x + (w - panelW) / 2;
        const panelY = y + (h - panelH) / 2;

        ctx.save();
        // Dark panel for self
        ctx.fillStyle = THEME.colors.panelBgDark;
        // Active border if it's my turn
        if (isCurrent) {
            ctx.shadowColor = THEME.colors.accent;
            ctx.shadowBlur = 15;
            ctx.strokeStyle = THEME.colors.accent;
            ctx.lineWidth = 2;
            this.roundRect(ctx, panelX, panelY, panelW, panelH, 16, true, true);
        } else {
            this.roundRect(ctx, panelX, panelY, panelW, panelH, 16, true, false);
        }
        ctx.shadowBlur = 0;
        ctx.restore();

        // Layout: Avatar Left, Info Middle, Cards Right
        
        // 1. Avatar (Left)
        const avR = panelH * 0.35;
        const avX = panelX + 30 + avR;
        const avY = panelY + panelH / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2);
        ctx.clip();
        if (me.avatarUrl && this.avatarImages[me.avatarUrl]?.loaded) {
            ctx.drawImage(this.avatarImages[me.avatarUrl].img, avX - avR, avY - avR, avR * 2, avR * 2);
        } else {
            ctx.fillStyle = '#78909C';
            ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.floor(avR)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(me.name.charAt(0).toUpperCase(), avX, avY);
        }
        ctx.restore();
        
        // Avatar Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Info (Name & Chips) - Middle Left
        const infoX = avX + avR + 20;
        ctx.textAlign = 'left';
        
        // Name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px Arial';
        ctx.textBaseline = 'bottom';
        ctx.fillText(me.name, infoX, avY - 4);
        
        // Chips (Pill)
        const chipVal = `$${me.chips}`;
        ctx.font = 'bold 16px Arial';
        const tm = ctx.measureText(chipVal);
        const pillW = tm.width + 24;
        const pillH = 26;
        const pillY = avY + 4;
        
        ctx.fillStyle = THEME.colors.chipBg;
        this.roundRect(ctx, infoX, pillY, pillW, pillH, 13, true);
        
        ctx.fillStyle = '#3E2723';
        ctx.textBaseline = 'middle';
        ctx.fillText(chipVal, infoX + 12, pillY + pillH/2);

        // 3. Hand Cards (Right)
        if (me.hand && me.status === 'playing') {
            const cardH = panelH * 0.7; // 70% of panel height
            const cardW = cardH * 0.7;  // Aspect ratio
            const gap = 8;
            
            const handW = 2 * cardW + gap;
            const handX = panelX + panelW - handW - 30; // Right margin 30
            const handY = panelY + (panelH - cardH) / 2;
            
            // Highlight cards if active
            if (isCurrent) {
                 ctx.shadowColor = THEME.colors.accent;
                 ctx.shadowBlur = 10;
            }

            this.drawCard(ctx, me.hand[0], handX, handY, cardW, cardH);
            this.drawCard(ctx, me.hand[1], handX + cardW + gap, handY, cardW, cardH);
            
            ctx.shadowBlur = 0;
            
            // Card Label (e.g. Hand Strength) could go here if available
        }
        
        // 4. Dealer Button (if applicable)
        const sbIndex = this.room.smallBlindIndex;
        if (typeof sbIndex === 'number') {
            let dIndex = (sbIndex - 1 + this.room.players.length) % this.room.players.length;
            if (meIndex === dIndex) {
                const dR = 10;
                const dX = avX + avR * 0.7; // Overlap bottom right of avatar
                const dY = avY + avR * 0.7;
                
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(dX, dY, dR, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ccc';
                ctx.stroke();
                
                ctx.fillStyle = '#000';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('D', dX, dY);
            }
        }
    }

    renderControls(ctx, rect) {
        const { x, y, w, h } = rect;
        // Buttons: Fold, Call, Raise
        // Only if it's my turn
        const meIndex = this.room.players.findIndex(p => p.id === this.userId);
        const me = this.room.players[meIndex];
        
        this.controlZones = []; // Reset zones

        if (this.room.game && this.room.game.currentPlayerIndex === meIndex && me.status === 'playing') {
             
             if (!this.isRaising) {
                 // Standard Controls
                 const btnCount = 3;
                 const gap = 20;
                 const totalGap = (btnCount + 1) * gap;
                 const btnW = Math.min((w - totalGap) / btnCount, 160); 
                 const btnH = 56;
                 const btnY = y + (h - btnH) / 2;
                 
                 const groupW = btnCount * btnW + (btnCount - 1) * gap;
                 const startX = x + (w - groupW) / 2;
                 
                 const actions = [
                     { label: 'Fold', color: THEME.colors.danger, action: 'fold' },
                     { label: 'Call', color: THEME.colors.primary, action: 'call' },
                     { label: 'Raise', color: THEME.colors.warning, action: 'raise_mode' }
                 ];
                 
                 actions.forEach((act, i) => {
                     const btnX = startX + i * (btnW + gap);
                     this.renderButton(ctx, act.label, btnX, btnY, btnW, btnH, act.color);
                     this.controlZones.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: act.action });
                 });
             } else {
                 // Raise UI Controls
                 // Calculate Limits
                 const currentBet = this.room.game.currentBet || 0;
                 const minRaise = this.room.game.minRaise || 20;
                 
                 const myBet = me.bet || 0;
                 const myTotalChips = me.chips + myBet; // Total stack (chips behind + already bet)
                 
                 const minTotalBet = currentBet + minRaise;
                 const maxTotalBet = myTotalChips;
                 
                 // Initial Value Setup (if 0 or invalid)
                 if (this.raiseAmount === 0) {
                     this.raiseAmount = (maxTotalBet < minTotalBet) ? maxTotalBet : minTotalBet;
                 }
                 
                 // Layout: 
                 // Row 1: [-] [Value] [+] [All-in]
                 // Row 2: [Cancel] [Confirm]
                 
                 const row1Y = y + 10;
                 const row2Y = y + h - 60;
                 const btnH = 44;
                 
                 // Row 1
                 const opBtnW = 50;
                 const valW = 100;
                 const allInW = 70;
                 const gap = 10;
                 
                 const totalRow1W = opBtnW * 2 + valW + allInW + gap * 3;
                 let currX = x + (w - totalRow1W) / 2;
                 
                 // [-]
                 this.renderButton(ctx, '-', currX, row1Y, opBtnW, btnH, '#607D8B');
                 this.controlZones.push({ x: currX, y: row1Y, w: opBtnW, h: btnH, action: 'decrease_raise' });
                 currX += opBtnW + gap;
                 
                 // Value
                 ctx.fillStyle = 'rgba(0,0,0,0.5)';
                 this.roundRect(ctx, currX, row1Y, valW, btnH, 8, true);
                 ctx.fillStyle = '#FFEB3B';
                 ctx.font = 'bold 20px Arial';
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText(`$${this.raiseAmount}`, currX + valW/2, row1Y + btnH/2);
                 currX += valW + gap;
                 
                 // [+]
                 this.renderButton(ctx, '+', currX, row1Y, opBtnW, btnH, '#607D8B');
                 this.controlZones.push({ x: currX, y: row1Y, w: opBtnW, h: btnH, action: 'increase_raise' });
                 currX += opBtnW + gap;
                 
                 // [All-in]
                 this.renderButton(ctx, 'All-in', currX, row1Y, allInW, btnH, '#D32F2F');
                 this.controlZones.push({ x: currX, y: row1Y, w: allInW, h: btnH, action: 'all_in' });
                 
                 // Row 2
                 const actionBtnW = 120;
                 const actionGap = 20;
                 const row2StartX = x + (w - (actionBtnW * 2 + actionGap)) / 2;
                 
                 // Cancel
                 this.renderButton(ctx, 'Cancel', row2StartX, row2Y, actionBtnW, btnH, '#757575');
                 this.controlZones.push({ x: row2StartX, y: row2Y, w: actionBtnW, h: btnH, action: 'cancel_raise' });
                 
                 // Confirm
                 this.renderButton(ctx, 'Confirm', row2StartX + actionBtnW + actionGap, row2Y, actionBtnW, btnH, '#388E3C');
                 this.controlZones.push({ x: row2StartX + actionBtnW + actionGap, y: row2Y, w: actionBtnW, h: btnH, action: 'confirm_raise' });
             }
        }
    }

    renderButton(ctx, label, x, y, w, h, color) {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        
        ctx.fillStyle = color;
        this.roundRect(ctx, x, y, w, h, 8, true);
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, w, h, 8, false, true);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + w/2, y + h/2);
    }

    renderSeat(ctx, p, cx, cy, originalIndex, scale = 1.0) {
        // cx, cy is the center of the seat area
        const r = 26 * scale; // Avatar Radius

        // 1. Status Ring (Active Player / Timer)
        const isCurrent = (this.room.game && this.room.game.currentPlayerIndex === originalIndex);
        if (isCurrent) {
            ctx.strokeStyle = THEME.colors.accent;
            ctx.lineWidth = 4 * scale;
            ctx.beginPath();
            ctx.arc(cx, cy, r + 4 * scale, 0, Math.PI * 2);
            ctx.stroke();
            
            // Glow effect
            ctx.shadowColor = THEME.colors.accent;
            ctx.shadowBlur = 10 * scale;
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset
        }

        // 2. Avatar Background & Image
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        
        if (p.avatarUrl && this.avatarImages[p.avatarUrl]?.loaded) {
            ctx.drawImage(this.avatarImages[p.avatarUrl].img, cx - r, cy - r, r * 2, r * 2);
        } else {
            // Placeholder
            ctx.fillStyle = '#adb5bd';
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.floor(16 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.name.charAt(0).toUpperCase(), cx, cy);
        }
        ctx.restore();

        // Avatar Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Info Pill (Name & Chips) - Below Avatar
        const pillW = 80 * scale;
        const pillH = 34 * scale;
        const pillX = cx - pillW / 2;
        const pillY = cy + r + 5 * scale;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2, true);

        // Name
        ctx.fillStyle = THEME.colors.textSecondary;
        ctx.font = `${Math.floor(10 * scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const safeName = p.name.length > 8 ? p.name.substring(0, 6) + '..' : p.name;
        ctx.fillText(safeName, cx, pillY + 4 * scale);

        // Chips
        ctx.fillStyle = THEME.colors.accent;
        ctx.font = `bold ${Math.floor(11 * scale)}px Arial`;
        ctx.fillText(`$${p.chips}`, cx, pillY + 18 * scale);

        // 4. Action/Bet Bubble (If active or has bet)
        if (p.lastAction || p.bet > 0) {
            // Display above avatar
            const bubbleY = cy - r - 20 * scale;
            let text = p.lastAction || '';
            if (p.bet > 0) text = (p.lastAction ? p.lastAction + ' ' : '') + `$${p.bet}`;
            
            ctx.font = `bold ${Math.floor(12 * scale)}px Arial`;
            const textMetrics = ctx.measureText(text);
            const bubbleW = textMetrics.width + 16 * scale;
            const bubbleH = 20 * scale;
            
            ctx.fillStyle = THEME.colors.primary; // Green bubble
            if (p.lastAction === 'fold') ctx.fillStyle = THEME.colors.danger;
            
            this.roundRect(ctx, cx - bubbleW/2, bubbleY, bubbleW, bubbleH, 10 * scale, true);
            
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, cx, bubbleY + bubbleH/2);
        }

        // 5. Dealer Button
        const sbIndex = this.room.smallBlindIndex;
        if (typeof sbIndex === 'number') {
            let dIndex = (sbIndex - 1 + this.room.players.length) % this.room.players.length;
            if (originalIndex === dIndex) {
                const dX = cx + r; // Right side of avatar
                const dY = cy - r;
                ctx.fillStyle = '#fff';
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

        // 6. Cards (for Others)
        // Render to the right of avatar
        const isShowdown = (this.room.game && this.room.game.stage === 'showdown' && p.status === 'playing');
        
        if (p.status === 'playing') {
            const cardW = 28 * scale; 
            const cardH = 38 * scale;
            const cardX = cx + r + 10 * scale; 
            const cardY = cy; // Centered vertically relative to avatar center? No, start at cy

            // Adjust position based on where the player is sitting relative to center?
            // For simplicity, just put it to the right for everyone.
            
            if (isShowdown && p.hand) {
                this.drawCard(ctx, p.hand[0], cardX, cardY - cardH/2, cardW, cardH);
                this.drawCard(ctx, p.hand[1], cardX + cardW + 2 * scale, cardY - cardH/2, cardW, cardH);
            } else {
                // Back
                this.drawCardBack(ctx, cardX, cardY - cardH/2, cardW, cardH);
                this.drawCardBack(ctx, cardX + 10 * scale, cardY - cardH/2, cardW, cardH); 
            }
        }
    }

    // Old Showdown Overlay - Removed in favor of renderResultPage
    // renderShowdownOverlay(ctx) { ... }

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
        ctx.fillStyle = THEME.colors.cardBack; // Indigo
        this.roundRect(ctx, x, y, w, h, 4, true, false);
        
        // Pattern (Cross hatch or simple border)
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
        
        // Center Design
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(x + w/2, y + h/2, w/4, 0, Math.PI*2);
        ctx.fill();
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

    handleTouchMove(x, y) {
        if (this.room && this.room.game && this.room.game.stage === 'showdown') {
            const dy = y - this.lastTouchY;
            // Threshold to start dragging
            if (Math.abs(dy) > 5 || this.isDragging) {
                this.isDragging = true;
                this.resultScrollY -= dy;
                
                // Clamp
                if (this.resultScrollY < 0) this.resultScrollY = 0;
                if (this.resultScrollY > this.maxScrollY) this.resultScrollY = this.maxScrollY;
                
                this.render(canvas.getContext('2d'));
            }
        }
        this.lastTouchY = y;
    }

    async handleTouchEnd(x, y) {
        if (this.isDragging) {
            this.isDragging = false;
            return; // Was a drag, not a click
        }
        
        // Handle Click for Showdown (deferred from Start to support scroll)
        if (this.room && this.room.game && this.room.game.stage === 'showdown') {
             // Check Result Page Button (Host Only, Next Game)
             if (this.resultBtn) {
                  const btn = this.resultBtn;
                  if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                      console.log('[PokerGame] Clicked Next Game');
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
                  }
             }
        }
    }

    async touchHandler(x, y) {
        this.lastTouchY = y;
        this.isDragging = false;

        // Check Back Button (Top Left) - Valid for Waiting and Showdown
        const isPlaying = this.room && this.room.status === 'playing';
        if (!isPlaying) {
             const dx = x - (this.backBtnX + this.backBtnRadius);
             const dy = y - this.backBtnY;
             if (dx*dx + dy*dy <= this.backBtnRadius * this.backBtnRadius) {
                 return 'back'; 
             }
        }

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

        // 3. Showdown Handling (Deferred to handleTouchEnd for Scroll)
        if (this.room && this.room.game && this.room.game.stage === 'showdown') {
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
                         } else if (action === 'raise_mode') {
                             this.isRaising = true;
                             this.raiseAmount = 0; 
                             this.render(canvas.getContext('2d'));
                             return 'raise_mode';
                         } else if (action === 'cancel_raise') {
                             this.isRaising = false;
                             this.render(canvas.getContext('2d'));
                             return 'cancel_raise';
                         } else if (action === 'confirm_raise') {
                             const currentBet = this.room.game.currentBet || 0;
                             // Calculate increment (Raise Amount ON TOP of current bet)
                             // User selected "Raise To" amount (Total Bet)
                             let increment = this.raiseAmount - currentBet;
                             if (increment < 0) increment = 0; // Safety
                             
                             await RoomManager.getInstance().takeAction(this.docId, this.userId, 'raise', increment);
                             this.isRaising = false;
                             return 'game_action';
                         } else if (['increase_raise', 'decrease_raise', 'all_in'].includes(action)) {
                             // Logic to adjust amount
                             const currentBet = this.room.game.currentBet || 0;
                             const minRaise = this.room.game.minRaise || 20;
                             
                             const meIndex = this.room.players.findIndex(p => p.id === this.userId);
                             const me = this.room.players[meIndex];
                             const myBet = me.bet || 0;
                             const myTotalChips = me.chips + myBet;
                             
                             const minTotalBet = currentBet + minRaise;
                             const maxTotalBet = myTotalChips;
                             
                             if (this.raiseAmount === 0) this.raiseAmount = (maxTotalBet < minTotalBet) ? maxTotalBet : minTotalBet;
                             
                             if (action === 'all_in') {
                                 this.raiseAmount = maxTotalBet;
                             } else {
                                 const step = this.room.game.minRaise || 20; // Use minRaise as step
                                 if (action === 'increase_raise') {
                                     this.raiseAmount += step;
                                     if (this.raiseAmount > maxTotalBet) this.raiseAmount = maxTotalBet;
                                 } else {
                                     this.raiseAmount -= step;
                                     if (this.raiseAmount < minTotalBet) {
                                          if (maxTotalBet < minTotalBet) this.raiseAmount = maxTotalBet;
                                          else this.raiseAmount = minTotalBet;
                                     }
                                 }
                             }
                             this.render(canvas.getContext('2d'));
                             return 'adjust_raise';
                         }
                         return 'game_action';
                     }
                 }
            }
        }
        
        // Waiting Room Logic (Start Game, Swap Seats)
        if (this.room && this.room.status === 'waiting') {
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
