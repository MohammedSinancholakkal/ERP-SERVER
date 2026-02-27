const express = require('express');
const router = express.Router();
const dayClosingController = require('../../controllers/financial/dayClosingController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/status', authMiddleware, dayClosingController.getDayClosingStatus);
router.post('/close', authMiddleware, dayClosingController.saveDayClosing);
router.get('/', authMiddleware, dayClosingController.getAllDayClosings);

module.exports = router;
