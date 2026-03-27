const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, auditController.getAuditLogs);
router.post('/page-visit', authMiddleware, auditController.logPageVisit);


module.exports = router;
