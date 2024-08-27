const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { type } = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


app.use(express.static(path.join(__dirname, '../client/public')));

let gameState = {
    board: Array(5).fill(null).map(() => Array(5).fill(null)),
    players: {
        A: {characters: [], turn: true, ready: false},
        
        B: {characters: [], turn: false, ready: false}
    },
    selectedCharacter: null
};

const clients = new Set();

let playerA = null;
let playerB = null;

// gameState.players.A.characters.forEach(c => {
//     gameState.board[c.row][c.col] = `A-${c.name}`;
// });

// gameState.players.B.characters.forEach(c => {
//     gameState.board[c.row][c.col] = `B-${c.name}`;
// })

const validCharacters = ['P1', 'P2', 'P3', 'P4', 'P5', 'H1', 'H2'];

const broadcastGameState = () => {
    const payload = {
        type: 'update',
        gameState : gameState,
    };
    sendToAllClients(JSON.stringify(payload));
    // wss.clients.forEach(client => {
    //     if(client.readyState === WebSocket.OPEN){
    //         client.send(JSON.stringify({type: 'update', gameState}));
    //     }
    // });
}

const broadcast = (message) => {
    wss.clients.forEach(client => {
        if(client.readyState === WebSocket.OPEN){
            client.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('New client connected');
    console.log();

    let player;
    if(!playerA){
        playerA = ws;
        player = 'A';
    } else if(!playerB){
        playerB = ws;
        player = 'B';
    } else{
        ws.close();
        return;
    }

    

    if(player){
        ws.send(JSON.stringify({type:'assignPlayer', player}));
        ws.send(JSON.stringify({type:'update', gameState}));
    } else{
        ws.send(JSON.stringify({type: 'error', message: 'Game is full'}));
        ws.close();
    }

    //ws.send(JSON.stringify({type: 'update', gameState}));

    ws.on('message', (message) => {
        console.log(`Received message from client: ${message}`);

        const data = JSON.parse(message);
        console.log('Message data: ', data);

        if(data.type === 'placeCharacter'){
            handlePlaceCharacter(data, ws);
        } else if(data.type === 'move'){
            handleMove(data, ws);
            // const {player, character, move, targetRow, targetCol} = data;
            // console.log(`Player ${player} >> ${character}:${move}`);
            // if(gameState.players[player].turn){
            //     if(validateMove(player, character, targetRow, targetCol)){
            //         processMove(player, character, move, targetRow, targetCol);
            //         broadcastGameState();
            //     } else{
            //         ws.send(JSON.stringify({type: 'invalidMove', reason: 'Invalid move'}));
            //     }
            // } else{
            //     ws.send(JSON.stringify({type: 'invalidMove', reason: 'Not your turn'}));
            // }  
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
        if(ws === playerA){
            playerA = null;
        }
        if(ws === playerB){
            playerB = null;
        }
    });
});

const sendToAllClients = (message) => {
    for(const client of clients){
        if(client.readyState === WebSocket.OPEN){
            client.send(message);
        }
    }
};

const getOpponentPlayer = (player) => {
    return player === 'A' ? 'B' : 'A';
};

const validateMove = (player, character, targetRow, targetCol) => {
    const char = gameState.players[player].characters.find(c => c.name === character);
    if(!char){
        console.log(`Character ${character} not found for player ${player}`);
        return false;
    } 

    console.log(`Validating move for ${character} from (${char.row}, ${char.col}) to (${targetRow}, ${targetCol})`);

    const rowDiff = Math.abs(targetRow - char.row);
    const colDiff = Math.abs(targetCol - char.col);

    console.log(`rowDiff: ${rowDiff}, colDiff: ${colDiff}`);

    let isValid = false;

    if(char.type === 'Pawn'){
        isValid = (rowDiff <= 1 && colDiff === 0) || (rowDiff === 0 && colDiff <= 1);
        if(isValid){
            const targetCell = gameState.board[targetRow][targetCol];
            if(targetCell !== null){
                if(targetCell.startsWith(getOpponentPlayer(player)) || targetCell.startsWith(player)){
                    isValid = false;
                } 
            } else{
                isValid = true;
            }
        }
    } else if(char.type === 'Hero1'){
        isValid = (rowDiff === 2 && colDiff === 0) || (rowDiff === 0 && colDiff === 2);
    } else if(char.type === 'Hero2'){
        isValid = (rowDiff === 2 && colDiff === 2);
    }
    
    console.log(`isValid: ${isValid}`);
    return isValid && targetRow >= 0 && targetRow < 5 && targetCol >= 0 && targetCol < 5;
};

const calculateNewPosition = (char, move) => {
    let newRow = char.row;
    let newCol = char.col;

    switch(char.type){
        case 'Pawn':
            switch(move){
                case 'F':
                    newRow -= 1;
                    break;
                case 'B':
                    newRow += 1;
                    break;
                case 'L':
                    newCol -= 1;
                    break;
                case 'R':
                    newCol += 1;
                    break;
            }
            break;

        case 'Hero1':
            switch(move){
                case 'F':
                    newRow -= 2;
                    break;
                case 'B':
                    newRow += 2;
                    break;
                case 'L':
                    newCol -= 2;
                    break;
                case 'R':
                    newCol += 2;
                    break;
            }
            break;
        
        case 'Hero2':
            switch(move){
                case 'FL':
                    newRow -= 2;
                    newCol -= 2;
                    break;
                case 'BL':
                    newRow += 2;
                    newCol -= 2;
                    break;
                case 'FR':
                    newRow -= 2;
                    newCol += 2;
                    break;
                case 'BR':
                    newRow += 2;
                    newCol += 2;
                    break;
            }
            break;
            
            
        default:
            console.error('Invalid character type:', char.type);
            return { row: char.row, col: char.col };
    }
    return { row:newRow, col:newCol};        
};


const calculatePathForMove = (char, move) => {
    const path = [];
    const startPosition = { row: char.row, col: char.col };
    const endPosition = calculateNewPosition(char, move);

    console.log(`calculatePathForMove: char.row=${char.row}, char.col=${char.col}, endPosition.row=${endPosition.row}, endPosition.col=${endPosition.col}`);

    if(endPosition.row < 0 || endPosition.row >=5 || endPosition.col < 0 || endPosition.col >= 5){
        return null;
    }

    if(char.type === 'Hero1'){
        const rowDiff = endPosition.row - startPosition.row;
        const colDiff = endPosition.col - startPosition.col;
        const rowStep = rowDiff !== 0 ? rowDiff / Math.abs(rowDiff) : 0;
        const colStep = colDiff !== 0 ? colDiff / Math.abs(colDiff) : 0;

        for(let i = 1; i <= 2; i++){
            const stepRow = startPosition.row + i * rowStep;
            const stepCol = startPosition.col + i * colStep;
            path.push({row: Math.round(stepRow), col: Math.round(stepCol)});
            console.log(`Hero1 Path Step: ${path[path.length - 1].row}, ${path[path.length - 1].col}`);
        }
    } else if(char.type === 'Hero2'){
        let intermediatePosition = { row: char.row, col: char.col };
        if(move === 'FL'){
            intermediatePosition = {row: char.row - 1, col: char.col - 1};
            path.push(intermediatePosition, endPosition);
        } else if(move === 'FR'){
            intermediatePosition = {row: char.row - 1, col: char.col + 1};
            path.push(intermediatePosition, endPosition);
        } else if(move === 'BL'){
            intermediatePosition = {row: char.row + 1, col: char.col - 1};
            path.push(intermediatePosition, endPosition);
        } else if(move === 'BR'){
            intermediatePosition = {row: char.row + 1, col: char.col + 1};
            path.push(intermediatePosition, endPosition);
        }
        console.log(`Hero2 Path Steps: ${intermediatePosition.row}, ${intermediatePosition.col} and ${endPosition.row}, ${endPosition.col}`);
    } else{
        path.push(endPosition);
    }
    return path;
}
const processMove = (player, character, move, targetRow, targetCol) => {
    if(!gameState.players[player].turn){
        console.log(`It's not player ${player}'s turn!`);
        return;
    }

    const char = gameState.players[player].characters.find(c => c.name === character);

    if(!char){
        console.error(`Character ${character} not found`);
        return;
    }

    let path  = calculatePathForMove(char, move);
    if(!path){
        console.log('Move was invalid or out of bounds');
        return;
    }

    // if(char.type === 'Hero1'){
    //     let stepRow = char.row;
    //     let stepCol = char.col;
    //     const rowDiff = targetRow - char.row;
    //     const colDiff = targetCol - char.col;
    //     const rowStep = rowDiff / Math.abs(rowDiff);
    //     const colStep = colDiff / Math.abs(colDiff);

    //     for(let i = 1; i <= 2; i++){
    //         stepRow = char.row + i * rowStep;
    //         stepCol = char.col + i * colStep;
    //         path.push({row: Math.round(stepRow), col: Math.round(stepCol)});
    //     }
    // }

    // if(char.type === 'Hero2'){
    //     let stepRow = char.row;
    //     let stepCol = char.col;
    //     const rowDiff = targetRow - char.row;
    //     const colDiff = targetCol - char.col;
    //     const rowStep = rowDiff !== 0 ? rowDiff / Math.abs(rowDiff) : 0;
    //     const colStep = colDiff !== 0 ? colDiff / Math.abs(colDiff) : 0;

    //     while(stepRow !== targetRow || stepCol !== targetCol){
    //         stepRow += rowStep;
    //         stepCol += colStep;
    //         if(char.type === 'Hero2' || Math.abs(stepRow - char.row) < 2){
    //             path.push({row: Math.round(stepRow), col: Math.round(stepCol)});
    //         }
    //     }
    // }

    let isValidMove = true;
    const opponentPlayer = player === 'A' ? 'B' : 'A';

    path.forEach((position, index) => {
        const targetCell = gameState.board[position.row][position.col];
        if(targetCell){
            if(targetCell.startsWith(player)){
                console.error('path is blocked by own character');
                isValidMove = false;
            } else if(index !== path.length - 1){
                gameState.players[opponentPlayer].characters = gameState.players[opponentPlayer].characters.filter(c => c.row !== position.row || c.col !== position.col);
                gameState.board[position.row][position.col] = null;
            }
        }
    });

    if(isValidMove){
        const newPosition = path[path.length - 1];
        console.log(newPosition);
        gameState.board[char.row][char.col] = null;
        gameState.board[newPosition.row][newPosition.col] = `${player}-${character}`;
        char.row = newPosition.row;
        char.col = newPosition.col;

        gameState.players[player].turn = false;
        const otherPlayer =  player === 'A' ? 'B' : 'A';
        gameState.players[otherPlayer].turn = true;

        broadcastGameState();
        console.log(`Moved ${character} to (${newPosition.row}, ${newPosition.col})`);
    } else{
        console.log('Move was invalid, no changes were made');
    }
    console.log();
};

const handlePlaceCharacter = (data, ws) => {
    const { player, character, row, col } = data;
    console.log(`Player ${player} placed ${character} at ${row}, ${col}`);


    if(!validCharacters.includes(character)){
        ws.send(JSON.stringify({type:'error', message: 'Invalid character input'}));
        return;
    }


    if(row < 0 || row >= 5 || col < 0 || col >= 5){
        ws.send(JSON.stringify({type: 'error', message : 'Invalid placement position'}));
        return;
    }

    const playerData = gameState.players[player];

    if(playerData.characters.length >= 5){
        ws.send(JSON.stringify({ type: 'error', message: 'Cannot place more than 5 characters'}));
        return;
    }

    if((player === 'A' && row !== 0) || (player === 'B' && row !== 4)){
        ws.send(JSON.stringify({type: 'error', message: 'Invalid placement row'}));
        return;
    }

    if(gameState.board[row][col] !== null){
        ws.send(JSON.stringify({type: 'error', message: 'Position already occupied'}));
        return;
    }

    playerData.characters.push({name: character, type: characterType(character), row, col});
    gameState.board[row][col] = `${player}-${character}`;

    ws.send(JSON.stringify({type: 'placementUpdate', characters: playerData.characters}));
    
    if(playerData.characters.length === 5){
        console.log(`${player} is ready`);
        playerData.ready = true;
    }

    if(gameState.players.A.ready && gameState.players.B.ready){
        console.log('Broadcasting startGame to all clients');
        broadcast(JSON.stringify({type: 'startGame'}));
        gameState.players.A.turn = true;
        gameState.players.B.turn = false;
        broadcastGameState();
    }
};

const handleMove = (data, ws) => {
    const { player, character, move, targetRow, targetCol } = data;
    if(playerA === ws || playerB === ws){
        processMove(player, character, move, targetRow, targetCol);
    } else{
        ws.send(JSON.stringify({type: 'error', message: 'Invalid player'}));
    }

    // gameState.players['A'] = !gameState.players['A'].turn;
    // gameState.players['B'] = !gameState.players['B'].turn;

    broadcastGameState();
};

const characterType = (character) => {
    if(character.startsWith('Pawn')) return 'Pawn';
    if(character.startsWith('Hero1')) return 'Hero1';
    if(character.startsWith('Hero2')) return 'Hero2';
    return 'Unknown';
};

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});