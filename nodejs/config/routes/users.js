import { User } from "../../model/user.js";
import jwt from 'jsonwebtoken';
import bcrypt from "bcryptjs";


export function usersRoutes(app, auth) {
    app.post('/login', async (req, res) => {
        try {
            // Get user input
            const { id, pin } = req.body;

            // Validate user input
            if (!(id && pin))
                return res.status(400).send('Всички полета са задължителни');

            // Check if user exists
            const user = await User.findById(id);

            if (!user)
                return res.status(400).send('Потребителят не съществува');

            // Check pin
            if (!(await bcrypt.compare(pin, user.pin)))
                return res.status(400).send('Грешен пин');

            // Create token
            const token = jwt.sign(
                { uid: user._id, name: user.name, role: user.role },
                process.env.TOKEN_KEY,
                {
                    expiresIn: "12h"
                }
            );

            // Save user token
            user.token = token;

            // Success, return user
            return res.status(200).send({ name: user.name, role: user.role, token });
        } catch (err) {
            console.error(err);
            res.status(500).send('Възникна грешка!');
        }
    });

    app.post('/createUser', auth, async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin')
                return res.status(401).send('Нямате админски достъп!')

            // Get user input
            const { name, pin, role } = req.body;

            // Validate user input
            if (!(name && pin && role))
                return res.status(400).send('Всички полета са задължителни!');

            // Check if PIN is 4 numbers
            if (/^\d{4}$/.test(pin) === false)
                return res.status(400).send('ПИН кодът трябва да е точно 4 числа!');

            if (['admin', 'bartender', 'waiter'].includes(role) === false)
                return res.status(400).send('Грешна длъжност!');

            // Check if name already created (duplicate name)
            const userExists = await User.findOne({ name });

            if (userExists)
                return res.status(409).send('Вече има създаден служител с това име!');

            // Encrypt user pin
            const encryptedUserPin = await bcrypt.hash(pin, 10);

            // Create user in database
            await User.create({
                name: name,
                pin: encryptedUserPin,
                role: role
            });

            res.status(201).send('Успешно създаден служител!');
        } catch (error) {
            console.error(error);
            res.status(500).send('Възникна грешка!');
        }
    });

    app.get('/getAllUsers', async (req, res) => {
        /* Returns list of all users (as {username, uid}) */

        // ({}, 'name') means "no search criteria", return only the "name" property
        const users = await User.find({}, 'name');

        res.json(users);
    });

    app.post('/deleteUser', auth, async (req, res) => {
        /*  Delete user by id */
        try {
            // Check if user is admin
            if (req.user.role !== 'admin')
                return res.status(401).send('Нямате админски достъп!')

            const { _id } = req.body;

            // Validate user input
            if (!_id)
                return res.status(400).send('Избери служител!');

            await User.findByIdAndDelete(_id);

            res.send('Успешно изтрихте този служител!');
        } catch (error) {
            console.error(error);
            res.status(500).send('Възникна грешка!');
        }
    });

    app.post('/editUser', auth, async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin')
                return res.status(401).send('Нямате админски достъп!')

            const { _id, selectedChange } = req.body;
            let newValue = req.body.newValue;

            // Validate user input
            if (!(selectedChange && newValue))
                return res.status(400).send('Избери промяна и стойност!');

            if (selectedChange === 'pin') {
                // Check if PIN is 4 numbers
                if (/^\d{4}$/.test(newValue) === false)
                    return res.status(400).send('ПИН кодът трябва да е точно 4 числа!');

                // Generate new pin with hash
                newValue = await bcrypt.hash(newValue, 10);
            }
            else if (selectedChange === 'role' && ['admin', 'bartender', 'waiter'].includes(newValue) === false) //if selected change is role and role is not one of: admin, bartender, waiter
                return res.status(400).send('Невалидна длъжност!');
            else if (selectedChange === 'name') {
                // Check if name already in use (duplicate name)
                const userExists = await User.findOne({ name: newValue });

                if (userExists)
                    return res.status(400).send('Това име вече е използвано!');
            }

            await User.findByIdAndUpdate(_id, { [selectedChange]: newValue });

            res.send('Успешна промяна!');
        } catch (error) {
            console.error(error);
            res.status(500).send('Възникна грешка!');
        }
    });
}