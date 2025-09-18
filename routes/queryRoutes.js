const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const queryController = require('../controllers/queryController');

// All routes require authentication
router.use(auth);

// Query routes
router.post('/', queryController.createQuery);
router.get('/', queryController.getQueries);
router.get('/stats/overview', queryController.getQueryStats);
router.get('/:id', queryController.getQueryById);
router.patch('/:id/update', queryController.updateQuery);
router.post('/:id/respond', queryController.addResponse);
router.post('/:id/assign', queryController.assignQuery);
router.put('/:id/status', queryController.updateStatus);
router.put('/:id/priority', queryController.updatePriority);
router.delete('/:id', queryController.deleteQuery);
router.get('/user/:userId', queryController.getUserQueries);
router.get('/assigned/:userId', queryController.getAssignedQueries);
router.put('/:id/pin', queryController.togglePin);

module.exports = router;
