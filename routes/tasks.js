var express = require('express');
var router = express.Router();
var Task = require('../models/task');
var User = require('../models/user');

// -------------------- GET /api/tasks --------------------
router.get('/', async (req, res) => {
    try {
        let query = Task.find();

        if (req.query.where) {
            const whereObj = JSON.parse(req.query.where);
            query = query.find(whereObj);
        }
        if (req.query.sort) {
            const sortObj = JSON.parse(req.query.sort);
            query = query.sort(sortObj);
        }
        if (req.query.select) {
            const selectObj = JSON.parse(req.query.select);
            query = query.select(selectObj);
        }
        if (req.query.skip) {
            query = query.skip(parseInt(req.query.skip));
        }

        if (req.query.limit) {
            query = query.limit(parseInt(req.query.limit));
        } else {
            query = query.limit(100);
        }

        if (req.query.count && req.query.count === "true") {
            const count = await query.countDocuments();
            return res.status(200).json({ message: 'OK', data: count });
        } else {
            const tasks = await query.exec();
            return res.status(200).json({ message: 'OK', data: tasks });
        }

    } catch (err) {
        res.status(400).json({ message: 'Bad request', data: err });
    }
});

// -------------------- GET /api/tasks/:id --------------------
router.get('/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found', data: {} });
        }
        res.status(200).json({ message: 'OK', data: task });
    } catch (err) {
        res.status(500).json({ message: 'Server error', data: err });
    }
});

// -------------------- POST /api/tasks --------------------
router.post('/', async (req, res) => {
    try {
        const newTask = new Task(req.body);
        const savedTask = await newTask.save();

        if (savedTask.assignedUser) {
            const user = await User.findById(savedTask.assignedUser);
            if (user) {
                user.pendingTasks.push(savedTask._id.toString());
                await user.save();
            }
        }

        res.status(201).json({ message: 'Task created', data: savedTask });
    } catch (err) {
        res.status(400).json({ message: 'Bad request', data: err });
    }
});

// -------------------- PUT /api/tasks/:id --------------------
router.put('/:id', async (req, res) => {
    try {
        const oldTask = await Task.findById(req.params.id);
        if (!oldTask) return res.status(404).json({ message: 'Task not found', data: {} });

        if (oldTask.assignedUser) {
            const oldUser = await User.findById(oldTask.assignedUser);
            if (oldUser) {
                oldUser.pendingTasks = oldUser.pendingTasks.filter(tid => tid !== oldTask._id.toString());
                await oldUser.save();
            }
        }
        const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });


        if (updatedTask.assignedUser) {
            const newUser = await User.findById(updatedTask.assignedUser);
            if (newUser && !newUser.pendingTasks.includes(updatedTask._id.toString())) {
                newUser.pendingTasks.push(updatedTask._id.toString());
                await newUser.save();
            }
        }

        res.status(200).json({ message: 'Task updated', data: updatedTask });
    } catch (err) {
        res.status(400).json({ message: 'Bad request', data: err });
    }
});

// -------------------- DELETE /api/tasks/:id --------------------
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

        res.status(204).json({ message: 'Task deleted', data: {} });
    } catch (err) {
        res.status(500).json({ message: 'Server error', data: err });
    }
});

module.exports = router;

