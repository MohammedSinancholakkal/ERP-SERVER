const sql = require("../db/dbConfig");

/**
 * Parses audit log Details into structured table/column/old/new fields.
 *
 * Trigger formats:
 *   UPDATE/INSERT: [Warehouses] CountryId: "80" → "32" (ID: 11)
 *   DELETE:        [Warehouses] DELETED - Name: "Test" (ID: 11)
 *   PAGE_VISIT:    Visited: Dashboard (/app/dashboard)
 *   LEGACY:        Updated Customer: OldName -> NewName (ID: 5)
 */
const parseAuditDetails = (action, details) => {
  if (!details) return { tableName: '-', columnName: '-', oldValue: '-', newValue: '-' };

  // ── PAGE_VISIT ─────────────────────────────────────────────────────────────
  if (action === 'PAGE_VISIT') {
    return { tableName: 'Navigation', columnName: '-', oldValue: '-', newValue: details.replace('Visited: ', '') };
  }

  // ── TRIGGER DELETE FORMAT: [Table] DELETED - ColName: "val" (ID: x) ────────
  // Support both "DELETED - Col: val" and just "DELETED (ID: x)"
  const delMatch = details.match(/^\[(.+?)\] DELETED - (.+?): ["']?(.*?)["']? \(ID: .*?\)$/);
  if (delMatch) {
    return {
      tableName:  delMatch[1],
      columnName: delMatch[2],
      oldValue:   delMatch[3] || '—',
      newValue:   'DELETED',
    };
  }

  const simpleDelMatch = details.match(/^\[(.+?)\] DELETED \(ID: (.*?)\)$/);
  if (simpleDelMatch) {
    return {
      tableName: simpleDelMatch[1],
      columnName: 'ID',
      oldValue: simpleDelMatch[2],
      newValue: 'DELETED'
    };
  }

  // ── TRIGGER INSERT/UPDATE: [Table] ColName: "old" → "new" (ID: x) ──────────
  // Handles arrow variants: → (unicode), -> (ascii), ? (encoding corruption)
  const isAdd    = action?.startsWith('ADD_') || action?.includes('CREATE');
  const fmBase   = /^\[(.+?)\]\s+(.+?):\s+["']?(.*?)["']?\s*(?:\u2192|->|\?|\u2013|\u2014|=>)\s*["']?(.*?)["']?\s*\(ID: .*?\)$/;
  const fieldMatch = details.match(fmBase);
  
  if (fieldMatch) {
    return {
      tableName:  fieldMatch[1],
      columnName: fieldMatch[2],
      oldValue:   isAdd ? 'NEW RECORD' : (fieldMatch[3] || '—'),
      newValue:   fieldMatch[4] || '—',
    };
  }

  // ── LEGACY RECOVERY: If it contains [Table] but doesn't match full pattern ─
  const partialMatch = details.match(/^\[(.+?)\] (.*?)$/);
  if (partialMatch) {
    return {
      tableName: partialMatch[1],
      columnName: '-',
      oldValue: '-',
      newValue: partialMatch[2]
    };
  }

  // ── LEGACY UPDATE: Updated X: old -> new (ID: x) ───────────────────────────
  const updateMatch = details.match(/Updated (.*?): (.*?) -> (.*?) \(ID: .*?\)/i);
  if (updateMatch) {
    return { tableName: updateMatch[1], columnName: 'Name', oldValue: updateMatch[2], newValue: updateMatch[3] };
  }

  // ── LEGACY RESTORE: Restored X (ID: x) ─────────────────────────────────────
  const restoreRegex = /Restored (.*?) \(ID: (.*?)\)/;
  const restoreMatch = details.match(restoreRegex);
  if (restoreMatch) {
    const tableName = restoreMatch[1].trim().toUpperCase();
    return { tableName, columnName: '-', oldValue: '-', newValue: `Restored ID: ${restoreMatch[2]}` };
  }

  const restoreRegex2 = /Restored (.*?): (.*?) \(ID: (.*?)\)/;
  const restoreMatch2 = details.match(restoreRegex2);
  if (restoreMatch2) {
    const tableName = restoreMatch2[1].trim().toUpperCase();
    return { tableName, columnName: '-', oldValue: '-', newValue: `Restored ${restoreMatch2[2]} (ID: ${restoreMatch2[3]})` };
  }

  // ── LEGACY CREATE: Created X: Name ─────────────────────────────────────────
  const createMatch = details.match(/Created (.*?): (.*)/i);
  if (createMatch) {
    return { tableName: createMatch[1], columnName: '-', oldValue: '-', newValue: createMatch[2] };
  }

  // ── LEGACY DELETE: Deleted X (ID: x) ───────────────────────────────────────
  const deleteMatch = details.match(/Deleted (.*?) \(ID: (.*?)\)/i);
  if (deleteMatch) {
    return { tableName: deleteMatch[1], columnName: 'ID', oldValue: deleteMatch[2], newValue: 'DELETED' };
  }

  // ── Visited fallback ───────────────────────────────────────────────────────
  const visitMatch = details.match(/^Visited: (.+)$/i);
  if (visitMatch) {
    return { tableName: 'Navigation', columnName: '-', oldValue: '-', newValue: visitMatch[1] };
  }

  const tableName = action?.split('_').length > 1 ? action.split('_').slice(1).join(' ') : (action || '-');
  return { tableName, columnName: '-', oldValue: '-', newValue: details };
};


exports.getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const { startDate, endDate, userId, tableName } = req.query;

    let whereClause = "WHERE 1=1";
    if (startDate) whereClause += ` AND A.Timestamp >= '${startDate} 00:00:00'`;
    if (endDate)   whereClause += ` AND A.Timestamp <= '${endDate} 23:59:59'`;
    if (userId)    whereClause += ` AND A.UserId = ${userId}`;
    if (tableName) whereClause += ` AND (A.Action LIKE '%${tableName}%' OR A.Details LIKE '%${tableName}%')`;

    const totalResult = await sql.query(`SELECT COUNT(*) AS Total FROM AuditLogs A ${whereClause}`);

    const query = `
      SELECT 
        A.Id,
        A.UserId,
        U.displayName AS UserName,
        A.Action,
        A.Details,
        A.IpAddress,
        A.Timestamp
      FROM AuditLogs A
      LEFT JOIN Users U ON A.UserId = U.userId
      ${whereClause}
      ORDER BY A.Timestamp DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);

    const records = result.recordset.map(row => {
      const parsed = parseAuditDetails(row.Action, row.Details);
      return { ...row, ...parsed };
    });

    res.status(200).json({
      total: totalResult.recordset[0].Total,
      records,
    });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);
    res.status(500).json({ message: "Error fetching audit logs" });
  }
};

// ─────────────────────────────────────────────────────────────
// PAGE VISIT LOGGER
// ─────────────────────────────────────────────────────────────
exports.logPageVisit = async (req, res) => {
  try {
    const { userId, page, label } = req.body;
    if (!userId || !page) return res.status(200).json({ ok: true }); // silent skip

    const details = label && label !== page
      ? `Visited: ${label} (${page})`
      : `Visited: ${page}`;

    await sql.query`
      INSERT INTO AuditLogs (UserId, Action, Details, IpAddress, Timestamp)
      VALUES (${userId}, 'PAGE_VISIT', ${details}, ${req.ip || null}, GETDATE())
    `;

    res.status(200).json({ ok: true });
  } catch (error) {
    // Non-critical — swallow the error, don't break anything
    console.error("PAGE VISIT LOG ERROR:", error);
    res.status(200).json({ ok: true });
  }
};

