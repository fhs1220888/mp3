var express = require('express');
var router = express.Router();
var User = require('../models/user');

// -------------------- GET /api/users --------------------
router.get('/', async (req, res) => {
    try {

        const whereParam = req.query.where || req.query.filter;
        const where = whereParam ? JSON.parse(whereParam) : {};

        const sort = req.query.sort ? JSON.parse(req.query.sort) : {};
        const select = req.query.select ? JSON.parse(req.query.select) : {};
        const skip = req.query.skip ? parseInt(req.query.skip) : 0;
        const limit = req.query.limit ? parseInt(req.query.limit) : 0;
        const count = req.query.count === 'true';

        if (count) {
            const result = await User.countDocuments(where);
            res.status(200).json({ message: 'OK', data: result });
        } else {
            const result = await User.find(where).sort(sort).select(select).skip(skip).limit(limit);
            res.status(200).json({ message: 'OK', data: result });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error', data: err });
    }
});


// -------------------- POST /api/users --------------------
router.post('/', async (req, res) => {
    try {

        if (!req.body.name || !req.body.email) {
            return res.status(400).json({ message: 'Name and email are required.', data: {} });
        }

        const existing = await User.findOne({ email: req.body.email });
        if (existing) {
            return res.status(400).json({ message: 'Email already exists.', data: {} });
        }

        const newUser = new User(req.body);
        const savedUser = await newUser.save();
        res.status(201).json({ message: 'User created', data: savedUser });
    } catch (err) {
        res.status(400).json({ message: 'Bad request', data: err });
    }
});

// -------------------- GET /api/users/:id --------------------
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found', data: {} });
        res.status(200).json({ message: 'OK', data: user });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid ID format', data: err });
        }
        res.status(500).json({ message: 'Server error', data: err });
    }
});

// -------------------- PUT /api/users/:id --------------------
router.put('/:id', async (req, res) => {
    try {
        if (req.body.email) {
            const existing = await User.findOne({ email: req.body.email, _id: { $ne: req.params.id } });
            if (existing) {
                return res.status(400).json({ message: 'Email already exists.', data: {} });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedUser) return res.status(404).json({ message: 'User not found', data: {} });

        res.status(200).json({ message: 'User updated', data: updatedUser });
    } catch (err) {
        res.status(400).json({ message: 'Bad request', data: err });
    }
});

// -------------------- DELETE /api/users/:id --------------------
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found', data: {} });

        const Task = require('../models/Task');
        await Task.updateMany(
            { assignedUser: user._id.toString() },
            { assignedUser: "", assignedUserName: "unassigned" }
        );

        await user.deleteOne();

        res.status(204).json({ message: 'User deleted and tasks unassigned', data: {} });
    } catch (err) {
        res.status(500).json({ message: 'Server error', data: err });
    }
});

module.exports = router;
