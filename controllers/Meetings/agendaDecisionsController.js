const sql = require("../../db/dbConfig");

// =============================================================
// GET AGENDA DECISIONS BY MEETING ID
// =============================================================
exports.getAgendaDecisions = async (req, res) => {
  const { meetingId } = req.query;

  try {
    const result = await sql.query`
      SELECT 
        ad.Id AS id,
        ad.Description AS description,
        ad.DueDate AS dueDate,
        ad.DecisionNumber AS decisionNumber,
        ad.AssignedTo AS assignedTo,
        ad.RelatedAgendaItem AS relatedAgendaItem,
        ad.ResolutionStatus AS resolutionStatus,
        ad.Meeting AS meetingId,
        ad.Images AS images,
        ad.Attachments AS attachments,
        
        -- Joined fields
        e.FirstName + ' ' + ISNULL(e.LastName, '') AS assignedToName,
        rs.Name AS resolutionStatusName,
        mai.Title AS relatedAgendaItemTitle

      FROM AgendaDecisions ad
      LEFT JOIN Employees e ON ad.AssignedTo = e.Id
      LEFT JOIN ResolutionStatuses rs ON ad.ResolutionStatus = CAST(rs.Id AS NVARCHAR(100))
      LEFT JOIN AgendaItems mai ON ad.RelatedAgendaItem = mai.Id
      WHERE ad.Meeting = ${meetingId} AND ad.IsActive = 1
      ORDER BY ad.Id ASC
    `;

    res.status(200).json({
      records: result.recordset
    });

  } catch (error) {
    console.error("GET AGENDA DECISIONS ERROR:", error);
    res.status(500).json({ message: "Server error fetching decisions" });
  }
};

// =============================================================
// ADD AGENDA DECISION
// =============================================================
exports.addAgendaDecision = async (req, res) => {
  const { 
    meetingId, 
    description,
    dueDate,
    assignedTo,
    decisionNumber,
    relatedAgendaItem,
    resolutionStatus,
    userId 
  } = req.body;

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
      INSERT INTO AgendaDecisions (
        Meeting, Description, DueDate, AssignedTo, DecisionNumber, 
        RelatedAgendaItem, ResolutionStatus,
        Images, Attachments, 
        IsActive, InsertUserId, InsertDate
      )
      VALUES (
        ${meetingId}, ${description}, ${dueDate}, ${assignedTo}, ${decisionNumber}, 
        ${relatedAgendaItem}, ${resolutionStatus},
        ${imagePath}, ${attachmentPath},
        1, ${userId}, GETDATE()
      )
    `;

    res.status(201).json({ message: "Decision added successfully" });

  } catch (error) {
    console.error("ADD DECISION ERROR:", error);
    res.status(500).json({ message: "Server error adding decision" });
  }
};

// =============================================================
// UPDATE AGENDA DECISION
// =============================================================
exports.updateAgendaDecision = async (req, res) => {
  const { id } = req.params;
  const { 
    description,
    dueDate,
    assignedTo,
    decisionNumber,
    relatedAgendaItem,
    resolutionStatus,
    userId 
  } = req.body;

  const imageFilename = req.files?.['imageFile']?.[0]?.filename || null;
  const attachmentFilename = req.files?.['attachmentFile']?.[0]?.filename || null;

  try {
    if (imageFilename || attachmentFilename) {
         await sql.query`
            UPDATE AgendaDecisions
            SET 
                Description = ${description},
                DueDate = ${dueDate},
                AssignedTo = ${assignedTo},
                DecisionNumber = ${decisionNumber},
                RelatedAgendaItem = ${relatedAgendaItem},
                ResolutionStatus = ${resolutionStatus},
                UpdateUserId = ${userId},
                UpdateDate = GETDATE(),
                Images = CASE WHEN ${imageFilename} IS NOT NULL THEN ${imageFilename} ELSE Images END,
                Attachments = CASE WHEN ${attachmentFilename} IS NOT NULL THEN ${attachmentFilename} ELSE Attachments END
            WHERE Id = ${id}
         `;
    } else {
        await sql.query`
            UPDATE AgendaDecisions
            SET 
                Description = ${description},
                DueDate = ${dueDate},
                AssignedTo = ${assignedTo},
                DecisionNumber = ${decisionNumber},
                RelatedAgendaItem = ${relatedAgendaItem},
                ResolutionStatus = ${resolutionStatus},
                UpdateUserId = ${userId},
                UpdateDate = GETDATE()
            WHERE Id = ${id}
         `;
    }

    res.status(200).json({ message: "Decision updated successfully" });

  } catch (error) {
    console.error("UPDATE DECISION ERROR:", error);
    res.status(500).json({ message: "Server error updating decision" });
  }
};

// =============================================================
// DELETE AGENDA DECISION
// =============================================================
exports.deleteAgendaDecision = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // usually passed in body for soft delete tracking

  try {
    await sql.query`
      UPDATE AgendaDecisions
      SET IsActive = 0, DeleteUserId = ${userId}, DeleteDate = GETDATE()
      WHERE Id = ${id}
    `;

    res.status(200).json({ message: "Decision deleted successfully" });

  } catch (error) {
    console.error("DELETE DECISION ERROR:", error);
    res.status(500).json({ message: "Server error deleting decision" });
  }
};
