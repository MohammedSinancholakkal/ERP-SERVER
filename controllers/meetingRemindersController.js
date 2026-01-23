/**
 * ============================================================================
 * MEETING REMINDERS CONTROLLER
 * ============================================================================
 * 
 * API endpoints for managing and retrieving meeting reminder history
 * 
 * Endpoints:
 * - GET /api/meeting-reminders/:meetingId        Get reminders for a meeting
 * - GET /api/meeting-reminders/status/:status     Get reminders by status
 * - GET /api/meeting-reminders/report/summary     Get summary report
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const logger = require('../utils/logger');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Optional: Add authentication middleware
// const authMiddleware = require('../middleware/authMiddleware');
// router.use(authMiddleware);

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/meeting-reminders/:meetingId
 * Retrieve reminder history for a specific meeting
 */
router.get('/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    if (!meetingId || isNaN(meetingId)) {
      return res.status(400).json({ 
        message: 'Invalid meeting ID' 
      });
    }
    
    const request = new sql.Request();
    
    const query = `
      SELECT 
        mr.[Id],
        mr.[MeetingId],
        mr.[ReminderType],
        mr.[SentAt],
        mr.[Status],
        mr.[ErrorMessage],
        mr.[CreatedAt],
        m.[MeetingName],
        m.[StartDate],
        m.[Recipients]
      FROM [MeetingReminders] mr
      LEFT JOIN [Meetings] m ON mr.[MeetingId] = m.[Id]
      WHERE mr.[MeetingId] = @meetingId
      ORDER BY mr.[CreatedAt] DESC
    `;
    
    request.input('meetingId', sql.Int, meetingId);
    const result = await request.query(query);
    
    logger.info(`Retrieved reminder history for meeting ${meetingId}`, {
      count: result.recordset.length
    });
    
    res.status(200).json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    logger.error('Failed to retrieve meeting reminders', {
      error: error.message,
      meetingId: req.params.meetingId
    });
    
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

/**
 * GET /api/meeting-reminders/status/:status
 * Retrieve all reminders with a specific status
 */
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    
    const validStatuses = ['SENT', 'FAILED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be SENT or FAILED' 
      });
    }
    
    const request = new sql.Request();
    
    const query = `
      SELECT 
        mr.[Id],
        mr.[MeetingId],
        mr.[ReminderType],
        mr.[SentAt],
        mr.[Status],
        mr.[ErrorMessage],
        mr.[CreatedAt],
        m.[MeetingName],
        m.[StartDate]
      FROM [MeetingReminders] mr
      LEFT JOIN [Meetings] m ON mr.[MeetingId] = m.[Id]
      WHERE mr.[Status] = @status
      ORDER BY mr.[CreatedAt] DESC
    `;
    
    request.input('status', sql.VarChar(20), status.toUpperCase());
    const result = await request.query(query);
    
    logger.info(`Retrieved ${result.recordset.length} reminders with status: ${status}`);
    
    res.status(200).json({
      success: true,
      status: status.toUpperCase(),
      count: result.recordset.length,
      data: result.recordset
    });
  } catch (error) {
    logger.error('Failed to retrieve reminders by status', {
      error: error.message,
      status: req.params.status
    });
    
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

/**
 * GET /api/meeting-reminders/report/summary
 * Get summary report of reminders
 */
router.get('/report/summary', async (req, res) => {
  try {
    const request = new sql.Request();
    
    // Get daily summary
    const dailyQuery = `
      SELECT 
        CONVERT(DATE, [CreatedAt]) AS Date,
        COUNT(*) AS TotalReminders,
        SUM(CASE WHEN [Status] = 'SENT' THEN 1 ELSE 0 END) AS SentCount,
        SUM(CASE WHEN [Status] = 'FAILED' THEN 1 ELSE 0 END) AS FailedCount
      FROM [MeetingReminders]
      GROUP BY CONVERT(DATE, [CreatedAt])
      ORDER BY Date DESC
    `;
    
    const dailyResult = await request.query(dailyQuery);
    
    // Get overall stats
    const statsQuery = `
      SELECT 
        COUNT(*) AS TotalReminders,
        SUM(CASE WHEN [Status] = 'SENT' THEN 1 ELSE 0 END) AS SentCount,
        SUM(CASE WHEN [Status] = 'FAILED' THEN 1 ELSE 0 END) AS FailedCount,
        MIN([CreatedAt]) AS FirstReminder,
        MAX([CreatedAt]) AS LastReminder
      FROM [MeetingReminders]
    `;
    
    const statsResult = await request.query(statsQuery);
    const stats = statsResult.recordset[0] || {
      TotalReminders: 0,
      SentCount: 0,
      FailedCount: 0,
      FirstReminder: null,
      LastReminder: null
    };
    
    logger.info('Generated reminder summary report');
    
    res.status(200).json({
      success: true,
      summary: {
        totalReminders: stats.TotalReminders,
        sent: stats.SentCount,
        failed: stats.FailedCount,
        successRate: stats.TotalReminders > 0 
          ? ((stats.SentCount / stats.TotalReminders) * 100).toFixed(2) + '%'
          : 'N/A',
        firstReminder: stats.FirstReminder,
        lastReminder: stats.LastReminder
      },  
      dailyBreakdown: dailyResult.recordset
    });
  } catch (error) {
    logger.error('Failed to generate summary report', {
      error: error.message
    });
    
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

/**
 * GET /api/meeting-reminders/export/csv
 * Export reminder data as CSV
 */
router.get('/export/csv', async (req, res) => {
  try {
    const request = new sql.Request();
    
    const query = `
      SELECT 
        mr.[Id],
        mr.[MeetingId],
        m.[MeetingName],
        m.[StartDate],
        mr.[ReminderType],
        mr.[SentAt],
        mr.[Status],
        mr.[ErrorMessage],
        mr.[CreatedAt]
      FROM [MeetingReminders] mr
      LEFT JOIN [Meetings] m ON mr.[MeetingId] = m.[Id]
      ORDER BY mr.[CreatedAt] DESC
    `;
    
    const result = await request.query(query);
    
    // Convert to CSV
    const headers = [
      'Id', 'MeetingId', 'MeetingName', 'StartDate', 'ReminderType',
      'SentAt', 'Status', 'ErrorMessage', 'CreatedAt'
    ];
    
    const csvContent = [
      headers.join(','),
      ...result.recordset.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          if (value === null || value === undefined) return '';
          const strValue = String(value).replace(/"/g, '""');
          return strValue.includes(',') ? `"${strValue}"` : strValue;
        }).join(',')
      )
    ].join('\n');
    
    logger.info('Exported reminder data as CSV', {
      recordCount: result.recordset.length
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=meeting-reminders.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    logger.error('Failed to export reminders as CSV', {
      error: error.message
    });
    
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

/**
 * DELETE /api/meeting-reminders/:id
 * Delete a specific reminder record (soft delete if applicable)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        message: 'Invalid reminder ID' 
      });
    }
    
    const request = new sql.Request();
    
    const query = `
      DELETE FROM [MeetingReminders]
      WHERE [Id] = @id
    `;
    
    request.input('id', sql.Int, id);
    const result = await request.query(query);
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ 
        message: 'Reminder not found' 
      });
    }
    
    logger.info(`Deleted reminder record: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete reminder', {
      error: error.message,
      id: req.params.id
    });
    
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

router.use((err, req, res, next) => {
  logger.error('Unhandled error in reminder routes', {
    error: err.message,
    path: req.path
  });
  
  res.status(500).json({
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
