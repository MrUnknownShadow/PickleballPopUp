const { Pool, types, defaults } = require("pg");

// Every TIMESTAMP column holds UTC. Read them as UTC and write Dates as UTC, so the server's own
// timezone never changes what is stored or shown (event times are sent as exact moments by the browser).
types.setTypeParser(1114, (s) => new Date(s.replace(" ", "T") + "Z"));
defaults.parseInputDatesAsUTC = true;

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const db = {
  query: (text, params) => pool.query(text, params),
};

module.exports = db;