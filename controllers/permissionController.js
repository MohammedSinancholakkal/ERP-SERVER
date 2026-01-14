const sql = require("../db/dbConfig");

// GET ALL PERMISSIONS
exports.getAllPermissions = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        Id AS id,
        PermissionKey AS [key],
        Name AS name,
        ParentKey AS parentKey
      FROM Permissions
      WHERE IsActive = 1
    `;

    // --- LOGIC MOVED FROM FRONTEND (UserManagement.jsx) ---
    const buildPermissionTree = (flatList) => {
      const map = {};
      const roots = [];

      // Initialize
      flatList.forEach((item) => {
        map[item.key] = { ...item, granted: false, children: [] };
      });

      // Build Hierarchy
      flatList.forEach((item) => {
        if (item.parentKey && map[item.parentKey]) {
          map[item.parentKey].children.push(map[item.key]);
        } else {
          // If parent not found or is root, push to roots
          roots.push(map[item.key]);
        }
      });

      return roots;
    };

    const tree = buildPermissionTree(result.recordset);
    res.status(200).json(tree);

  } catch (error) {
    console.error("GET PERMISSIONS ERROR:", error);
    res.status(500).json({ message: "Error fetching permissions" });
  }
};
