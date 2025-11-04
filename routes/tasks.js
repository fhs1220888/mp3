var express = require('express');
var router = express.Router();
var Task = require('../models/task');
var User = require('../models/user');

// GET /api/tasks
router.get('/', async (req, res) => {
    try {
        let query = Task.find();

        if (req.query.where) {
            const whereObj = JSON.parse(req.query.where);
            query = query.find(whereObj);
        }

        if (req.query.filter) {
            const filterObj = JSON.parse(req.query.filter);
            query = query.select(filterObj);
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

        if (req.query.count && req.query.count === "true") {
            const count = await query.countDocuments();
            return res.status(200).json({ message: 'OK', data: count });
        } else {
            const tasks = await query.exec();
            return res.status(200).json({ message: 'OK', data: tasks || [] });
        }

    } catch (err) {
        res.status(400).json({ message: 'Bad request', data: err });
    }
});


// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found', data: {} });
        }
        res.status(200).json({ message: 'OK', data: task });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid ID format', data: err });
        }
        res.status(500).json({ message: 'Server error', data: err.message });
    }
});

// POST /api/tasks
router.post('/', async (req, res) => {
    const session = await User.startSession();
    session.startTransaction();
    try {
        const newTask = new Task(req.body);
        const savedTask = await newTask.save({ session });

        if (savedTask.assignedUser) {
            await User.findByIdAndUpdate(
                savedTask.assignedUser,
                { $addToSet: { pendingTasks: savedTask._id.toString() } },
                { session }
            );
        }

        await session.commitTransaction();
        session.endSession();
        res.status(201).json({ message: 'Task created', data: savedTask });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ message: 'Bad request', data: err });
    }
});


// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
    try {
        const oldTask = await Task.findById(req.params.id);
        if (!oldTask)
            return res.status(404).json({ message: 'Task not found', data: {} });

        // Remove from old user's pendingTasks if needed
        if (oldTask.assignedUser) {
            const oldUser = await User.findById(oldTask.assignedUser);
            if (oldUser) {
                oldUser.pendingTasks = oldUser.pendingTasks.filter(
                    (tid) => tid !== oldTask._id.toString()
                );
                oldUser.pendingTasks = [...new Set(oldUser.pendingTasks)];
                await oldUser.save();
            }
        }
        // Update task itself
        const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        // Add to new user
        if (updatedTask.assignedUser) {
            const newUser = await User.findById(updatedTask.assignedUser);
            if (newUser) {
                newUser.pendingTasks.push(updatedTask._id.toString());
                newUser.pendingTasks = [...new Set(newUser.pendingTasks)];
                await newUser.save();
            }
        }

        res.status(200).json({ message: 'Task updated', data: updatedTask });
    } catch (err) {
        res.status(400).json({ message: 'Bad request', data: err });
    }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found', data: {} });

        if (task.assignedUser) {
            const user = await User.findById(task.assignedUser);
            if (user) {
                user.pendingTasks = user.pendingTasks.filter(tid => tid !== task._id.toString());
                await user.save();
            }
        }

        res.status(204).end();
    } catch (err) {
        res.status(500).json({ message: 'Server error', data: err });
    }
});

module.exports = router;

