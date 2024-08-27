let gameState = null;
let player = null;
const socket = new WebSocket('ws://localhost:3000');

socket.addEventListener('open', () => {
    console.log('Connected to the server');
});

socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    console.log('Received from server:', data);

    if(data.type === 'assignPlayer'){
        player = data.player;
        console.log(`You are Player ${player}`);
        initializeSetupUI();
    }else if(data.type === 'update'){
        gameState = data.gameState;
        console.log('Updating game board with:', data.gameState.board);
        if(gameState && gameState.board){
            updateGameBoard(gameState.board);
        }else{
            console.error('Game state or board is not defined');
        }
        
    } else if(data.type === 'invalidMove'){
        alert(data.reason);
    } else if(data.type === 'placementUpdate'){
        gameState = data.gameState;
        updateGameBoard(gameState.board);
    } else if(data.type === 'startGame'){
        console.log('Game is starting');
        gameState = data.gameState;
        const gameBoardElement = document.getElementById('gameBoard');
        gameBoardElement.style.display = 'block';

        updateGameBoard(gameState.board);
    }
});

let selectedCharacter = null;
let selectedCell = null;

const selectCharacter = (rowIndex, colIndex) =>{
    // if(gameState.players['A'].turn){
        const character = gameState.board[rowIndex][colIndex];
    
        if(selectedCell){
            selectedCell.classList.remove('selected');
        }
        
        if(character && character.startsWith(player)){
            selectedCharacter = {character, rowIndex, colIndex};
            console.log(`Selected ${character} at (${rowIndex}, ${colIndex})`);


            selectedCell = document.querySelector(`.cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
            if(selectedCell){
                selectedCell.classList.add('selected');
            }
        } else{
            selectCharacter = null;
        }
    // }
};

const determineMove = (startRow, startCol, endRow, endCol) => {
    const rowDiff = endRow - startRow;
    const colDiff = endCol - startCol;
    
    //for the pawn
    if(Math.abs(rowDiff) <= 1 && colDiff === 0){
        if(rowDiff === -1) return 'F';
        if(rowDiff === 1) return 'B';
    }
    if(rowDiff === 0 && Math.abs(colDiff) <= 1){
        if(colDiff === -1) return 'L';
        if(colDiff === 1) return 'R';
    }

    //for Hero1
    if(Math.abs(rowDiff) === 2 && colDiff === 0){
        if(rowDiff === -2) return 'F';
        if(rowDiff === 2) return 'B';
    }
    if(rowDiff === 0 && Math.abs(colDiff) === 2){
        if(colDiff === -2) return 'L';
        if(colDiff === 2) return 'R';
    }

    //for Hero2
    if(Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2){
        if(rowDiff === -2 && colDiff === -2) return 'FL';
        if(rowDiff === -2 && colDiff === 2) return 'FR';
        if(rowDiff === 2 && colDiff === -2) return 'BL';
        if(rowDiff === 2 && colDiff === 2) return 'BR';
    }
    
    return null;
};

const isValidMove = (rowIndex, colIndex, selectedCharacter, player) => {
    if(rowIndex < 0 || rowIndex >= 5 || colIndex < 0 || colIndex >= 5){
        return false;
    }
    const targetCell = gameState.board[rowIndex][colIndex];
    if(targetCell && targetCell.startsWith(player === 'A' ? 'B': 'A')){
        return false;
    }
    return true;
}

const deselectCharacter = () => {
    if(selectedCell){
        selectedCell.classList.remove('selected');
        selectedCell = null;
    }
    selectedCharacter = null;
    console.log('Character deselected');
}

const moveCharacter = (rowIndex, colIndex) => {
    if(selectedCharacter){
        const move =  determineMove(selectedCharacter.rowIndex, selectedCharacter.colIndex, rowIndex, colIndex);
        if(move){
            console.log(`Sending move ${move} to (${rowIndex}, ${colIndex})`);
            socket.send(JSON.stringify({
                type: 'move',
                player: player,
                character: selectedCharacter.character.split('-')[1],
                move: move,
                targetRow: rowIndex,
                targetCol: colIndex
            }));
            deselectCharacter();
        } else{
            console.log('Invalid move direction, deselecting');
            deselectCharacter();
        }
    } else{
        console.log('No character selected');
    }
};



const updateGameBoard = (boardState) => {
    if(!boardState){
        console.error('Board state is not defined');
        return;
    }
    board.innerHTML = ''; // clear current board
    boardState.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');
            cellDiv.setAttribute('data-row', rowIndex);
            cellDiv.setAttribute('data-col', colIndex);
            if(cell){
                cellDiv.textContent = cell;
            }
            cellDiv.addEventListener('click', () => {
                if(gameState.players[player].turn){
                    if(selectedCharacter){
                        moveCharacter(rowIndex, colIndex);
                    } else{
                        selectCharacter(rowIndex, colIndex);
                    }
                } else{
                    alert('Wait for your turn');
                }
            });
            board.appendChild(cellDiv);
        });
    });

    const turnIndicator = document.getElementById('turnIndicator');
    const currentTurn = gameState.players['A'].turn ? 'A' : 'B';
    turnIndicator.textContent = `Turn: Player ${currentTurn}`;

    if(selectCharacter){
        const selected = document.querySelector(`.cell[data-row="${selectedCharacter.rowIndex}"][data-col="${selectedCharacter.colIndex}"]`);
        if(selected){
            selected.classList.add('selected');
        }
    }
};

const initializeSetupUI = () => {
    const playerASetup = document.getElementById('playerASetup');
    const playerBSetup = document.getElementById('playerBSetup');
    const confirmSetupButton = document.getElementById('confirmSetup');
    
    playerASetup.innerHTML = '';
    playerBSetup.innerHTML = '';

    playerASetup.style.display = player === 'A' ? 'block' : 'none';
    playerBSetup.style.display = player === 'B' ? 'block' : 'none';

    for(let i = 0; i < 5; i++){
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 2;
        input.classList.add('input-field');
        input.id = `${player}-${i}`;
        if(player === 'A'){
            playerASetup.appendChild(input);
        } else{
            playerBSetup.appendChild(input);
        }
        
    }
    

    confirmSetupButton.addEventListener('click', () => {
        const playerChars = Array.from({length: 5}, (_, i) => 
            document.getElementById(`${player}-${i}`).value.trim().toUpperCase()
        );

        
        socket.send(JSON.stringify({
            type: 'initialSetup',
            player: player,
            setup: playerChars   
        }));
        
        
        document.getElementById('initialization').style.display = 'none';
    });
    document.getElementById('gameBoard').style.display = 'none';

};

socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if(message.type === 'startGame'){
        document.getElementById('initialization').style.display = 'none';
        document.getElementById('gameBoard').style.display ='grid';
    } else if(message.type === 'update'){
        gameState = message.gameState;
        console.log('Updating game board with: ', gameState.board);
        updateGameBoard(gameState.board);
    } else if(message.type === 'invalidMove'){
        alert(message.reason);
    } else if (message.type === 'placementUpdate'){
        gameState = message.gameState;
        updateGameBoard(gameState.board);
    }
});

const board = document.getElementById('gameBoard');
for(let i = 0; i < 25; i++){
    const cell = document.createElement('div');
    cell.classList.add('cell');
    board.appendChild(cell);
}
