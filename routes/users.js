var express = require('express');
var router = express.Router();
var User = require('../models/user');

// GET /api/users
router.get('/', async (req, res) => {
    try {
        let query = User.find();
        if (req.query.where) {
            try {
                const whereObj = JSON.parse(req.query.where);
                query = query.find(whereObj);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid JSON in where parameter', data: {} });
            }
        }

        if (req.query.filter) {
            try {
                const filterObj = JSON.parse(req.query.filter);
                query = query.select(filterObj);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid JSON in filter parameter', data: {} });
            }
        }

        if (req.query.sort) {
            const sortObj = JSON.parse(req.query.sort);
            query = query.sort(sortObj);
        }

        if (req.query.select) {
            const selectObj = JSON.parse(req.query.select);
            query = query.select(selectObj);
        }

        if (req.query.skip) query = query.skip(parseInt(req.query.skip));
        if (req.query.limit) query = query.limit(parseInt(req.query.limit));

        if (req.query.count === 'true') {
            const count = await query.countDocuments();
            return res.status(200).json({ message: 'OK', data: count });
        }

        const users = await query.exec();
        res.status(200).json({ message: 'OK', data: users });

    } catch (err) {
        console.error('User GET error:', err);
        res.status(400).json({ message: 'Bad request', data: err.message });
    }
});



// POST /api/users
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

// GET /api/users/:id
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

// PUT /api/users/:id
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

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found', data: {} });

        const Task = require('../models/task');
        // Unassign all tasks assigned to this user
        await Task.updateMany(
            { assignedUser: req.params.id },
            { assignedUser: "", assignedUserName: "unassigned" }
        );

        await user.deleteOne();
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ message: 'Server error', data: err });
    }
});

module.exports = router;
