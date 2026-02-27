const express = require('express');
const router = express.Router();
const cashAdjustmentController = require('../../controllers/financial/cashAdjustmentController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/', authMiddleware, cashAdjustmentController.getAllCashAdjustments);
router.post('/', authMiddleware, cashAdjustmentController.addCashAdjustment);
router.put('/:id', authMiddleware, cashAdjustmentController.updateCashAdjustment);
router.delete('/:id', authMiddleware, cashAdjustmentController.deleteCashAdjustment);

module.exports = router;
