const sql = require("../../db/dbConfig");

// =============================================================
// GET AGENDA ITEMS BY MEETING ID
// =============================================================
exports.getAgendaItems = async (req, res) => {
  const { meetingId } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        mai.Id AS id,
        mai.Title AS title,
        mai.Description AS description,
        mai.SequenceNo AS sequenceNo,
        mai.Images AS images,
        mai.Attachments AS attachments,
        mai.Meeting AS meetingId,
        mai.ItemType AS itemTypeId,
        mai.RequestedBy AS requestedBy,
        
        -- Joined fields
        ait.Name AS itemTypeName,
        e.FirstName + ' ' + ISNULL(e.LastName, '') AS requestedByName

      FROM AgendaItems mai
      LEFT JOIN AgendaItemTypes ait ON mai.ItemType = CAST(ait.Id AS NVARCHAR(100))
      LEFT JOIN Employees e ON mai.RequestedBy = e.Id
      WHERE mai.Meeting = ${meetingId} AND mai.IsActive = 1
      ORDER BY mai.SequenceNo ASC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET AGENDA ITEMS ERROR:", error);
    res.status(500).json({ message: "Server error fetching agenda items" });
  }
};

// =============================================================
// ADD AGENDA ITEM
// =============================================================
exports.addAgendaItem = async (req, res) => {
  console.log("DEBUG ADD AGENDA ITEM BODY:", req.body);
  const { 
    meetingId, 
    title, 
    description, 
    itemTypeId, 
    requestedBy, 
    sequenceNo,
    userId 
  } = req.body;

  // Handle files
  // Multer adds req.files['imageFile'] and req.files['attachmentFile'] arrays
  let imagePath = null;
  let attachmentPath = null;

  if (req.files && req.files['imageFile'] && req.files['imageFile'][0]) {
    imagePath = req.files['imageFile'][0].filename;
  }
  
  if (req.files && req.files['attachmentFile'] && req.files['attachmentFile'][0]) {
    attachmentPath = req.files['attachmentFile'][0].filename;
  }

  try {
    await sql.query`
      INSERT INTO AgendaItems (
        Meeting, Title, Description, ItemType, RequestedBy, SequenceNo, 
        Images, Attachments, 
        IsActive, InsertUserId, InsertDate
      )
      VALUES (
        ${meetingId}, ${title}, ${description}, ${itemTypeId}, ${requestedBy}, ${sequenceNo},
        ${imagePath}, ${attachmentPath},
        1, ${userId}, GETDATE()
      )
    `;

    res.status(201).json({ message: "Agenda item added successfully" });

  } catch (error) {
    console.error("ADD AGENDA ITEM ERROR:", error);
    res.status(500).json({ message: "Server error adding agenda item" });
  }
};

// =============================================================
// UPDATE AGENDA ITEM
// =============================================================
exports.updateAgendaItem = async (req, res) => {
  console.log("DEBUG UPDATE AGENDA ITEM BODY:", req.body);
  const { id } = req.params;
  const { 
    title, 
    description, 
    itemTypeId, 
    requestedBy, 
    sequenceNo, 
    userId 
  } = req.body;





  try {


    const imageFilename = req.files?.['imageFile']?.[0]?.filename || null;
    const attachmentFilename = req.files?.['attachmentFile']?.[0]?.filename || null;


    
    if (imageFilename || attachmentFilename) {
         // This is getting complex to support all combos. 
         // Let's stick to the most robust way: 1 query, passing params, usage of CASE/ISNULL logic.
         await sql.query`
            UPDATE AgendaItems
            SET  
                Title = ${title},
                Description = ${description},
                ItemType = ${itemTypeId},
                RequestedBy = ${requestedBy},
                SequenceNo = ${sequenceNo},
                UpdateUserId = ${userId},
                UpdateDate = GETDATE(),
                Images = CASE WHEN ${imageFilename} IS NOT NULL THEN ${imageFilename} ELSE Images END,
                Attachments = CASE WHEN ${attachmentFilename} IS NOT NULL THEN ${attachmentFilename} ELSE Attachments END
            WHERE Id = ${id}
         `;
    } else {
        await sql.query`
            UPDATE AgendaItems
            SET 
                Title = ${title},
                Description = ${description},
                ItemType = ${itemTypeId},
                RequestedBy = ${requestedBy},
                SequenceNo = ${sequenceNo},
                UpdateUserId = ${userId},
                UpdateDate = GETDATE()
            WHERE Id = ${id}
         `;
    }

    res.status(200).json({ message: "Agenda item updated successfully" });

  } catch (error) {
    console.error("UPDATE AGENDA ITEM ERROR:", error);
    res.status(500).json({ message: "Server error updating agenda item" });
  }
};

// =============================================================
// DELETE AGENDA ITEM (Soft Delete)
// =============================================================
exports.deleteAgendaItem = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    await sql.query`
      UPDATE AgendaItems
      SET IsActive = 0, DeleteUserId = ${userId}, DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Agenda item deleted successfully" });

  } catch (error) {
    console.error("DELETE AGENDA ITEM ERROR:", error);
    res.status(500).json({ message: "Server error deleting agenda item" });
  }
};
