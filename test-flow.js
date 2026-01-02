
import RoomManager from './js/runtime/poker/room-manager.js';

// Mock wx cloud database
global.wx = {
    cloud: {
        database: () => ({
            collection: (name) => ({
                add: async ({ data }) => {
                    console.log('DB Add:', data);
                    return { _id: 'mock_doc_id_' + Date.now() };
                },
                doc: (id) => ({
                    get: async () => {
                        // Return mock room data
                        return { data: global.mockRoomData };
                    },
                    update: async ({ data }) => {
                        // console.log('DB Update:', JSON.stringify(data, null, 2));
                        // Apply updates to global.mockRoomData
                        if (data.status) global.mockRoomData.status = data.status;
                        if (data.game) global.mockRoomData.game = data.game;
                        if (data.players) {
                            if (Array.isArray(data.players)) {
                                global.mockRoomData.players = data.players;
                            } else if (data.players.push) {
                                // simulate push - handled by command
                                const item = data.players.item; // simplified
                                global.mockRoomData.players.push(item);
                            }
                        }
                        return { stats: { updated: 1 } };
                    },
                    remove: async () => {
                        console.log('DB Remove');
                    }
                }),
                where: () => ({
                    get: async () => ({ data: [] })
                })
            }),
            command: {
                push: (item) => {
                    // primitive mock for push
                    if (global.mockRoomData && global.mockRoomData.players) {
                         global.mockRoomData.players.push(item);
                    }
                    return { push: true, item: item }; 
                },
                set: (val) => val
            },
            serverDate: () => new Date()
        })
    },
    showToast: () => {},
    showLoading: () => {},
    hideLoading: () => {}
};

async function testFlow() {
    const roomManager = RoomManager.getInstance();
    
    console.log('--- Creating Room ---');
    const user = { name: 'TestHost', avatarUrl: 'http://host.png' };
    const createRes = await roomManager.createRoom(user);
    console.log('Create Res Success:', createRes.success);
    
    global.mockRoomData = createRes.room; // Initialize mock data
    const docId = createRes.docId;
    
    console.log('--- Adding Bot ---');
    await roomManager.addBot(docId);
    console.log('Players:', global.mockRoomData.players.map(p => p.name));
    
    console.log('--- Starting Game ---');
    const startRes = await roomManager.startGame(docId, createRes.userId);
    console.log('Start Res Success:', startRes.success);
    
    if (global.mockRoomData.status !== 'playing') {
        console.error('Game failed to start');
        return;
    }
    
    console.log('--- Bot Turn Simulation ---');
    
    const currentPlayerIndex = global.mockRoomData.game.currentPlayerIndex;
    const currentPlayer = global.mockRoomData.players[currentPlayerIndex];
    console.log('Current Player:', currentPlayer.name);
    
    if (currentPlayer.isBot) {
        console.log('Bot should act...');
        await roomManager.botAction(docId, currentPlayer.id);
    } else {
        console.log('Host acting (call)...');
        await roomManager.takeAction(docId, createRes.userId, 'call');
        // Now it should be Bot's turn
        const nextPlayerIndex = global.mockRoomData.game.currentPlayerIndex;
        const nextPlayer = global.mockRoomData.players[nextPlayerIndex];
        console.log('Next Player:', nextPlayer.name);
        if (nextPlayer.isBot) {
             console.log('Bot acting...');
             await roomManager.botAction(docId, nextPlayer.id);
        }
    }
    
    console.log('--- Resetting Game ---');
    await roomManager.resetGame(docId);
    console.log('Room Status:', global.mockRoomData.status);
    console.log('Players Status:', global.mockRoomData.players.map(p => p.status));
    
    console.log('--- Removing Bot ---');
    await roomManager.removeBot(docId);
    console.log('Players:', global.mockRoomData.players.map(p => p.name));
}

testFlow();
