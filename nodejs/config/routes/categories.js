import { Category } from "../../model/category.js";
import { Product } from "../../model/product.js";

export function categoriesRoutes(app, auth) {
    app.post('/getAllCategories', auth, async (req, res) => {
        try {
            const { showHidden } = req.body;
            let categories;
            if (showHidden === false)
                categories = await Category.find({ hidden: false }).sort({ position: 1 });
            else
                categories = await Category.find().sort({ position: 1 });

            res.json(categories);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/createCategory', auth, async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin')
                return res.status(401).send('Нямате админски достъп!')

            const { name } = req.body;

            // Validate user input
            if (!(name))
                return res.status(400).send('Въведи име!');

            await Category.create({ name });

            res.send('Успешно създадохте нова категория!');
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/deleteCategory', auth, async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin')
                return res.status(401).send('Нямате админски достъп!')

            const { _id } = req.body;

            // Validate user input
            if (!_id)
                return res.status(400).send('Избери категория!');

            await Product.deleteMany({ category: _id }); // delete products inside category
            await Category.findByIdAndDelete(_id); // delete category

            res.send('Успешно изтрихте категорията!');
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/editCategory', auth, async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin')
                return res.status(401).send('Нямате админски достъп!')

            const { _id, name } = req.body;
            // Validate user input
            if (!(_id && name))
                return res.status(400).send('Избери категория и ново име!');

            // Update category name
            await Category.findByIdAndUpdate(_id, { name });

            res.send('Успешна промяна!');
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/sortCategories', auth, async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin')
                return res.status(401).send('Нямате админски достъп!')

            // Get array of categories in new order
            const categories = req.body;

            for (let i = 0; i < categories.length; i++) {
                // i will be the order number
                // i+1 because 'order' always starts at 1 (if 0 it doesnt show 'order' and breaks code)
                // categories[i] is the category _id
                await Category.findByIdAndUpdate(categories[i], { position: i + 1 });
            }

            res.send('Успешна подредба!');
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });
}