class Leaderboard {
    constructor() {
        this.scores = JSON.parse(localStorage.getItem('mazeGameLeaderboard')) || {};
    }

    addScore(levelName, time) {
        if (!this.scores[levelName]) {
            this.scores[levelName] = [];
        }
        this.scores[levelName].push(time);
        this.scores[levelName].sort((a, b) => a - b);
        this.scores[levelName] = this.scores[levelName].slice(0, 5); // Keep only top 5 scores
        this.saveScores();
    }

    getScores(levelName) {
        return this.scores[levelName] || [];
    }

    saveScores() {
        localStorage.setItem('mazeGameLeaderboard', JSON.stringify(this.scores));
    }

    displayLeaderboard() {
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.innerHTML = '<h2>Leaderboard</h2>';
        const levels = ["Easy", "Medium", "Hard"];
        for (let levelName of levels) {
            const scores = this.scores[levelName] || [];
            const leaderboardHtml = `
                <h3>${levelName}</h3>
                <ol>
                    ${scores.map(score => `<li>${score.toFixed(2)} seconds</li>`).join('')}
                </ol>
            `;
            leaderboardDiv.innerHTML += leaderboardHtml;
        }
    }

    clearLeaderboard() {
        this.scores = {};
        this.saveScores();
        this.displayLeaderboard();
    }
}

export const leaderboard = new Leaderboard();