/**
 * Meeting Reminders Routes
 * 
 * This module exports the meeting reminders API routes.
 * 
 * Routes:
 * - GET  /api/meeting-reminders/:meetingId          Get reminders for meeting
 * - GET  /api/meeting-reminders/status/:status      Get reminders by status
 * - GET  /api/meeting-reminders/report/summary      Get summary report
 * - GET  /api/meeting-reminders/export/csv          Export as CSV
 * - DELETE /api/meeting-reminders/:id               Delete reminder record
 * 
 * Usage in server.js:
 * const meetingRemindersRoutes = require('./routes/meetingRemindersRoutes');
 * ERP_SERVER.use('/api/meeting-reminders', meetingRemindersRoutes);
 */

const meetingRemindersController = require('../controllers/meetingRemindersController');

module.exports = meetingRemindersController;
