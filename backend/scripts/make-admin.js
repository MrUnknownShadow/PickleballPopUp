// Usage: node scripts/make-admin.js <username>   (use --remove to revoke)
require("dotenv").config({ quiet: true });
const db = require("../src/db");
const [name, flag] = process.argv.slice(2);
if (!name) { console.error("Usage: node scripts/make-admin.js <username> [--remove]"); process.exit(1); }
db.query("UPDATE Users SET IsAdmin = $2 WHERE LOWER(Username) = LOWER($1) RETURNING Username", [name, flag !== "--remove"])
  .then((r) => { console.log(r.rows[0] ? `${r.rows[0].username}: admin=${flag !== "--remove"}` : "No such user"); process.exit(0); })
  .catch((e) => { console.error(e.message); process.exit(1); });
