import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../../render';
import RoomManager from './room-manager';
import AIManager from '../ai-manager'; // Import AI Manager

const THEME = {
    colors: {
        bg: '#0F5132', 
        bgInner: '#1a5e3a',
        bgOuter: '#0a3622',
        accent: '#FFD700', // Gold
        primary: '#28a745', // Green (Call)
        danger: '#dc3545', // Red (Fold/Exit)
        warning: '#fd7e14', // Orange (Raise)
        text: '#FFFFFF',
        textSecondary: '#e0e0e0',
        cardBack: '#B22222',
        overlay: 'rgba(0,0,0,0.7)',
        panel: 'rgba(0,0,0,0.3)'
    },
    fonts: {
        xs: '10px Arial',
        sm: '12px Arial',
        md: '14px Arial',
        lg: 'bold 16px Arial',
        xl: 'bold 24px Arial'
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
                } else {
                    wx.showToast({ title: 'Room closed', icon: 'none' });
                    this.quit();
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
        grad.addColorStop(0, 'rgba(0,0,0,0.6)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);

        // Exit Button (Top Left)
        const btnR = 18;
        const btnX = x + 25;
        const btnY = y + h / 2; // Vertically centered in banner
        
        this.exitBtnCenter = { x: btnX, y: btnY, r: btnR };

        // Button Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon (Back Arrow or X)
        ctx.strokeStyle = THEME.colors.text;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Simple 'X'
        const iconSize = 8;
        ctx.moveTo(btnX - iconSize, btnY - iconSize);
        ctx.lineTo(btnX + iconSize, btnY + iconSize);
        ctx.moveTo(btnX + iconSize, btnY - iconSize);
        ctx.lineTo(btnX - iconSize, btnY + iconSize);
        ctx.stroke();

        // Room Info (Next to Exit Button)
        if (this.room) {
            ctx.fillStyle = THEME.colors.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = THEME.fonts.md;
            
            const sbVal = this.room.smallBlind || 100;
            const bbVal = this.room.bigBlind || 200;
            
            // Separator
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(btnX + btnR + 15, btnY - 10, 1, 20);

            // Text
            ctx.fillStyle = THEME.colors.text;
            ctx.fillText(`Blinds: ${sbVal}/${bbVal}`, btnX + btnR + 30, btnY);
        }
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
        
        const totalPlayers = this.room.players.length; // Or others.length + 1
        
        // Distribution Logic based on User Specs
        if (totalPlayers <= 3) {
            // All others go to Top
            // N=2 (1 other): [0] -> Top
            // N=3 (2 others): [0, 1] -> Top
            farIndices = others.map((_, i) => i);
            nearIndices = [];
        } else {
            // N=4, 5, 6
            // Top gets middle chunk, Bottom gets ends (0 and last)
            // N=4 (3 others): Bottom [0, 2], Top [1]
            // N=5 (4 others): Bottom [0, 3], Top [1, 2]
            // N=6 (5 others): Bottom [0, 4], Top [1, 2, 3]
            
            nearIndices.push(0); // First (Left)
            for (let i = 1; i < others.length - 1; i++) {
                farIndices.push(i); // Middle (Top)
            }
            nearIndices.push(others.length - 1); // Last (Right)
        }

        // Render Far Players (Top Area)
        // Center them horizontally
        // Slot width logic or just centered blocks?
        // User says: "Fixed size: Width 20% of screen"
        const blockW = SCREEN_WIDTH * 0.20;
        const blockH = SCREEN_HEIGHT * 0.10;
        
        // Calculate total width needed for N blocks
        // We can add some gap between blocks
        const gap = 10;
        const totalContentW = farIndices.length * blockW + (farIndices.length - 1) * gap;
        const startX = rect.x + (rect.w - totalContentW) / 2;
        const y = rect.y + (rect.h - blockH) / 2; // Vertically center in the band
        
        farIndices.forEach((idx, i) => {
            const pObj = others[idx];
            const x = startX + i * (blockW + gap);
            this.renderPlayerBlock(ctx, pObj.player, x, y, blockW, blockH, pObj.originalIndex);
        });
        
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
        
        const blockW = SCREEN_WIDTH * 0.20;
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
        // Design Specs:
        // - No overlap
        // - W: 20%, H: 10%
        // - Content Priority: Avatar, Name, Chips, Action Label, Fold Marker
        
        // 1. Folded State (Semi-transparent)
        const isFolded = (p.status === 'folded');
        ctx.save();
        if (isFolded) {
            ctx.globalAlpha = 0.5;
        }

        // Debug: Draw Block Boundary (Optional, remove later)
        // ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        // ctx.strokeRect(x, y, w, h);

        const centerX = x + w / 2;
        const centerY = y + h / 2;
        
        // 2. Avatar (Center, Large)
        // Max radius that fits height with padding
        // Available Height ~ 60% for Avatar?
        // Layout:
        // Top: Action Label (Overlay)
        // Middle: Avatar
        // Bottom: Name & Chips
        
        const r = Math.min(w, h) * 0.35; 
        const avY = centerY - 10; // Shift up slightly to leave room for text
        
        // Active Player Glow
        const isCurrent = (this.room.game && this.room.game.currentPlayerIndex === originalIndex);
        if (isCurrent) {
            ctx.shadowColor = THEME.colors.accent;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(centerX, avY, r + 2, 0, Math.PI * 2);
            ctx.strokeStyle = THEME.colors.accent;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Avatar Image
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, avY, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#333';
        ctx.fillRect(centerX - r, avY - r, r * 2, r * 2);
        
        if (p.avatarUrl && this.avatarImages[p.avatarUrl]?.loaded) {
            ctx.drawImage(this.avatarImages[p.avatarUrl].img, centerX - r, avY - r, r * 2, r * 2);
        } else {
            ctx.fillStyle = '#adb5bd';
            ctx.fillRect(centerX - r, avY - r, r * 2, r * 2);
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.floor(r)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.name.charAt(0).toUpperCase(), centerX, avY);
        }
        ctx.restore();
        
        // Avatar Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, avY, r, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Name & Chips (Bottom)
        // Background Pill
        const pillW = w * 0.9;
        const pillH = h * 0.35;
        const pillX = centerX - pillW / 2;
        const pillY = avY + r - 5; // Overlap bottom of avatar slightly
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2, true);
        
        // Text
        ctx.textAlign = 'center';
        
        // Name
        ctx.fillStyle = THEME.colors.textSecondary;
        ctx.font = `${Math.floor(h * 0.15)}px Arial`; // Adaptive font
        ctx.textBaseline = 'bottom';
        const safeName = p.name.length > 8 ? p.name.substring(0, 6) + '..' : p.name;
        ctx.fillText(safeName, centerX, pillY + pillH / 2 - 1);
        
        // Chips
        ctx.fillStyle = THEME.colors.accent;
        ctx.font = `bold ${Math.floor(h * 0.16)}px Arial`;
        ctx.textBaseline = 'top';
        ctx.fillText(`$${p.chips}`, centerX, pillY + pillH / 2 + 1);

        // 4. Action Label (Top Right)
        if (p.lastAction || p.bet > 0) {
            let label = p.lastAction || '';
            // If bet > 0 and action is 'bet'/'raise'/'call', show amount?
            // User requested "Action Content" e.g. "下注", "跟注"
            // Let's combine if there is a bet amount
            if (p.bet > 0 && label) label += ` $${p.bet}`;
            else if (p.bet > 0) label = `$${p.bet}`;
            
            if (label) {
                ctx.font = `bold ${Math.floor(h * 0.14)}px Arial`;
                const tm = ctx.measureText(label);
                const tagW = tm.width + 10;
                const tagH = h * 0.2;
                const tagX = x + w - tagW; // Align Right
                const tagY = y; // Align Top
                
                // Tag Bg
                ctx.fillStyle = THEME.colors.primary;
                if (p.lastAction === 'fold') ctx.fillStyle = THEME.colors.danger;
                if (p.lastAction === 'raise') ctx.fillStyle = THEME.colors.warning;
                
                // Rounded corner only on bottom-left? Or full rounded
                this.roundRect(ctx, tagX, tagY, tagW, tagH, 4, true);
                
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, tagX + tagW / 2, tagY + tagH / 2);
            }
        }
        
        // 5. Folded Marker (Visual Cross or Icon?)
        if (isFolded) {
            // Draw a red X over the avatar? Or just relying on opacity is enough?
            // User said "若已弃牌需显示明确的视觉标记"
            ctx.strokeStyle = THEME.colors.danger;
            ctx.lineWidth = 3;
            ctx.beginPath();
            // X over avatar
            const d = r * 0.7;
            ctx.moveTo(centerX - d, avY - d);
            ctx.lineTo(centerX + d, avY + d);
            ctx.moveTo(centerX + d, avY - d);
            ctx.lineTo(centerX - d, avY + d);
            ctx.stroke();
            
            // Text "FOLD"
            ctx.fillStyle = THEME.colors.danger;
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // ctx.fillText('FOLD', centerX, avY);
        }

        ctx.restore();
        
        // 6. Dealer Button (Relative to block)
        // Check dealer index
         const sbIndex = this.room.smallBlindIndex;
        if (typeof sbIndex === 'number') {
            let dIndex = (sbIndex - 1 + this.room.players.length) % this.room.players.length;
            if (originalIndex === dIndex) {
                const dR = 8;
                const dX = x + 12; // Top Left corner
                const dY = y + 12;
                
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(dX, dY, dR, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('D', dX, dY);
            }
        }
        
        // 7. Cards (If showdown or cheat/admin view?)
        // The spec didn't explicitly ask for cards in the "Player Block" for others, 
        // but typically we show backs or hands.
        // Let's render small cards to the right of avatar if there's space?
        // Or overlay?
        // Given 20% width, it's tight.
        // Let's put cards to the right of avatar, overlapping the pill?
        // Or maybe skip cards for others in this simplified block view unless showdown?
        // User spec didn't mention cards for others, only "Avatar, Name, Chips, Action, Fold".
        // But poker needs cards. I'll keep them small next to avatar if active.
        
        if (p.status === 'playing' && !isFolded) {
             const cardW = 16;
             const cardH = 22;
             // Position: Bottom Right of Avatar
             const cardX = centerX + r;
             const cardY = avY;
             
             // Draw Backs
             // this.drawCardBack(ctx, cardX, cardY, cardW, cardH);
             // this.drawCardBack(ctx, cardX + 5, cardY, cardW, cardH);
             // Actually, let's keep it clean as per spec. If user didn't ask for cards in block, maybe they are less important or handled elsewhere?
             // But existing game logic shows cards. I should keep them.
             // Let's place them neatly.
             
             const cX = centerX + r + 2;
             const cY = avY - cardH/2;
             
             const isShowdown = (this.room.game && this.room.game.stage === 'showdown');
             
             if (isShowdown && p.hand) {
                 this.drawCard(ctx, p.hand[0], cX, cY, cardW, cardH);
                 this.drawCard(ctx, p.hand[1], cX + cardW + 2, cY, cardW, cardH);
             } else {
                 this.drawCardBack(ctx, cX, cY, cardW, cardH);
                 this.drawCardBack(ctx, cX + 5, cY, cardW, cardH);
             }
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

        // Layout: Avatar Left, Cards Center, Info Right? 
        // Let's do: Avatar + Info on Left. Cards in Center/Right.
        
        const contentW = w * 0.9;
        const startX = x + (w - contentW) / 2;
        
        // 1. Avatar (Large)
        const avR = 30;
        const avX = startX + avR;
        const avY = y + h / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2);
        ctx.clip();
        if (me.avatarUrl && this.avatarImages[me.avatarUrl]?.loaded) {
            ctx.drawImage(this.avatarImages[me.avatarUrl].img, avX - avR, avY - avR, avR * 2, avR * 2);
        } else {
            ctx.fillStyle = '#adb5bd';
            ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
        }
        ctx.restore();
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Info (Name, Chips) - Right of Avatar
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(me.name, avX + avR + 15, avY - 2);
        
        ctx.textBaseline = 'top';
        ctx.fillStyle = THEME.colors.accent;
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`$${me.chips}`, avX + avR + 15, avY + 2);
        
        // 3. Hand Cards (Large)
        if (me.hand && me.status === 'playing') {
            const cardW = 50;
            const cardH = 70;
            const gap = 5;
            // Align to right side of area
            const handX = x + w - (cardW * 2 + gap) - 20; 
            const handY = y + (h - cardH) / 2;
            
            // Glow if my turn
            if (this.room.game && this.room.game.currentPlayerIndex === meIndex) {
                 ctx.shadowColor = THEME.colors.accent;
                 ctx.shadowBlur = 15;
            }

            this.drawCard(ctx, me.hand[0], handX, handY, cardW, cardH);
            this.drawCard(ctx, me.hand[1], handX + cardW + gap, handY, cardW, cardH);
            
            ctx.shadowBlur = 0;
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
             const btnCount = 3;
             const gap = 15;
             const totalGap = (btnCount + 1) * gap;
             const btnW = (w - totalGap) / btnCount;
             const btnH = 50;
             const btnY = y + (h - btnH) / 2;
             
             const actions = [
                 { label: 'Fold', color: THEME.colors.danger, action: 'fold' },
                 { label: 'Call', color: THEME.colors.primary, action: 'call' },
                 { label: 'Raise', color: THEME.colors.warning, action: 'raise' }
             ];
             
             actions.forEach((act, i) => {
                 const btnX = x + gap + i * (btnW + gap);
                 
                 // Gradient
                 const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
                 grad.addColorStop(0, act.color);
                 grad.addColorStop(1, act.color); // Simplified gradient
                 
                 // Shadow
                 ctx.shadowColor = 'rgba(0,0,0,0.4)';
                 ctx.shadowBlur = 6;
                 ctx.shadowOffsetY = 4;
                 
                 ctx.fillStyle = act.color; 
                 this.roundRect(ctx, btnX, btnY, btnW, btnH, 12, true);
                 
                 ctx.shadowBlur = 0;
                 ctx.shadowOffsetY = 0;
                 
                 // Text
                 ctx.fillStyle = '#fff';
                 ctx.font = 'bold 18px Arial';
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText(act.label, btnX + btnW / 2, btnY + btnH / 2);
                 
                 // Register Zone
                 this.controlZones.push({
                     x: btnX, y: btnY, w: btnW, h: btnH, action: act.action
                 });
             });
        }
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
