const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

app.use(express.json());

const db = new sqlite3.Database('database.db');

// Modify the users table to include a points field
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    playerId TEXT UNIQUE,
    telegramId TEXT,
    tonAddress TEXT,
    points INTEGER DEFAULT 0
)`);

// Add this new endpoint to get user data by telegramId
app.get('/api/get_user/:telegramId', (req, res) => {
    const telegramId = req.params.telegramId;
    db.get("SELECT * FROM users WHERE telegramId = ?", [telegramId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    });
});

// Update the check_player endpoint to check both playerId and telegramId
app.get('/api/check_player/:id', (req, res) => {
    console.log("Checking player:", req.params.id);
    const id = req.params.id;
    db.get("SELECT * FROM users WHERE playerId = ? OR telegramId = ?", [id, id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        console.log("Player exists:", row !== undefined);
        res.json({ exists: row !== undefined });
    });
});

// Add a new endpoint to update the score
app.post('/api/update_score', (req, res) => {
    const { playerId, color } = req.body;
    let pointsChange = 0;

    switch (color) {
        case 'green':
            pointsChange = 2;
            break;
        case 'gold':
            pointsChange = 10;
            break;
        case 'orange':
            pointsChange = -5;
            break;
        case 'purple':
            pointsChange = Math.floor(Math.random() * 21) - 10; // Random number between -10 and 10
            break;
        case 'red':
        default:
            pointsChange = -2;
            break;
    }

    db.run("UPDATE users SET points = points + ? WHERE playerId = ?", [pointsChange, playerId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        db.get("SELECT playerId, points FROM users WHERE playerId = ?", [playerId], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ 
                message: "Score updated successfully", 
                playerId: row.playerId,
                newScore: row.points,
                pointChange: pointsChange
            });
        });
    });
});

// Modify the get_players_data endpoint to include points
app.post('/api/get_players_data', (req, res) => {
    const { player1Id, player2Id } = req.body;
    db.all("SELECT name, playerId, telegramId, tonAddress, points FROM users WHERE playerId IN (?, ?)", 
        [player1Id, player2Id], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const [player1, player2] = rows;
        res.json({ 
            player1, 
            player2,
            player1Score: player1.points,
            player2Score: player2.points
        });
    });
});

// New endpoint to set user data
app.post('/api/set_user_data', (req, res) => {
    const { name, playerId, telegramId, tonAddress } = req.body;
    
    db.run(`INSERT OR REPLACE INTO users (name, playerId, telegramId, tonAddress) 
            VALUES (?, ?, ?, ?)`,
        [name, playerId, telegramId, tonAddress],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ 
                message: "User data updated successfully", 
                userId: this.lastID 
            });
        }
    );
});

app.listen(port, () => {
    console.log(`Express server running on port ${port}`);
});