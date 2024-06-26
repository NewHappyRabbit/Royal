import { Bill } from "../../model/bill.js";
import { ProductHistory } from "../../model/history.js";
import { Ingredient } from "../../model/ingredient.js";
import { Product } from "../../model/product.js";
import { Table } from "../../model/table.js";
import { User } from "../../model/user.js";
import { updateReport } from "./reports.js";

export async function convertPersonalBillToHistory() {
    try {
        const consumptionBills = await Bill.find({
            user: {
                $ne: undefined
            }
        }).populate('products.product');

        for (let bill of consumptionBills) {
            let historyProducts = [];
            let historyTotal = 0;
            const user = await User.findById(bill.user);

            for (let product of bill.products) { // for every product to pay
                // Remove qty from inventory
                let ingredientsArray = [];
                const prodRef = await Product.findById(product.product._id);

                // Check if product has ingredients
                if (prodRef.ingredients.length === 0) {
                    prodRef.qty -= product.qty;
                    await prodRef.save();
                }
                else {
                    for (let ingredient of prodRef.ingredients) {
                        const ingredientRef = await Ingredient.findById(ingredient.ingredient);
                        ingredientRef.qty -= ingredient.qty * product.qty;
                        await ingredientRef.save();


                        ingredientsArray.push({
                            name: ingredientRef.name,
                            qty: ingredient.qty,
                            price: ingredientRef.sellPrice,
                            ingredientRef: ingredientRef._id
                        });
                    }
                }


                historyProducts.push({
                    name: product.product.name,
                    qty: product.qty,
                    buyPrice: product.product.buyPrice,
                    sellPrice: product.product.sellPrice,
                    productRef: product.product._id,
                    ingredients: ingredientsArray
                });

                historyTotal += product.product.sellPrice * product.qty;
            }

            // Add action to history
            if (historyTotal > 0)
                await ProductHistory.create({
                    user: {
                        name: user.name,
                        userRef: user._id.toString()
                    },
                    action: 'consumed',
                    total: historyTotal,
                    products: historyProducts
                });

            // Delete bill
            await Bill.deleteOne({ _id: bill._id });
        }

        console.log('All consumption bills are turned into history!');
    } catch (err) {
        console.error(err);
    }
}

export function billsRoutes(app, auth) {
    app.post('/getLastPaidBillByTableId', auth, async (req, res) => {
        try {
            const { _id, billId } = req.body;

            // Get bill
            const bill = await Bill.findById(billId);

            // Find in history by id

            const allPaid = await ProductHistory.find({
                action: 'paid',
                billNumber: bill.number,
                table: _id
            });

            let lastPaid;

            if (allPaid.length)
                lastPaid = allPaid[allPaid.length - 1];

            res.json(lastPaid);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/moveProducts', auth, async (req, res) => {
        try {
            const { _id, productsToMove } = req.body;

            // Get reference to current bill and table
            const currentBill = await Bill.findById(productsToMove._id).populate('products.product');
            const currentTable = await Table.findById(productsToMove.table);

            // Get reference to new table (that we will move the products to)
            const newTable = await Table.findById(_id);

            // Check if newTable has bills
            let newBill = await Bill.findOne({
                table: _id,
                number: 1
            });

            if (!newBill) {
                // Generate bills for this table
                const bills = await generateBills(_id);

                // Find the bill with number: 1
                newBill = bills.find(bill => bill.number === 1);
            }

            // Move products from oldBill to newBill
            for (let product of productsToMove.products) { // for every product to pay
                // Find index of product in actual bill
                const index = currentBill.products.findIndex(prd => prd.product._id.toString() === product.product._id.toString());

                // Remove qty from originalBill
                currentBill.products[index].qty -= product.qty;

                // Check if qty === 0, remove product from bill
                if (currentBill.products[index].qty === 0)
                    currentBill.products.splice(index, 1);

                // Find index in newBill
                const index2 = newBill.products.findIndex(prd => prd.product.toString() === product.product._id.toString())

                if (index2 !== -1) {
                    // Product is in newBill, add qty
                    newBill.products[index2].qty += product.qty;
                } else {
                    // Push product to new bill
                    newBill.products.push({
                        product: product.product._id,
                        qty: product.qty
                    });
                }
            }

            await newBill.populate('products.product');

            const data = await recalculateBillTotal(currentBill);
            const data2 = await recalculateBillTotal(newBill);

            res.json(data2);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    async function recalculateTableTotal(_id) {
        const table = await Table.findById(_id);
        const bills = await Bill.find({ table: _id });

        let total = 0;
        for (let bill of bills)
            total += bill.total;

        table.total = total;
        await table.save();

        return table;
    }

    async function recalculateBillTotal(bill) {
        bill.total = 0;

        for (let product of bill.products)
            bill.total += product.product.sellPrice * product.qty;


        await bill.save();
        await recalculateTableTotal(bill.table);

        return bill;
    }

    app.post('/scrapProducts', auth, async (req, res) => {
        try {
            const { billToScrap } = req.body;

            if (billToScrap.products.length === 0)
                return res.status(404).send('Няма продукти в сметката');

            let historyProducts = [];
            let historyTotal = 0;

            const originalBill = await Bill.findById(billToScrap._id).populate('products.product'); // the whole bill
            const table = await Table.findById(originalBill.table);

            for (let product of billToScrap.products) { // for every product to pay
                // Find index of product in actuall bill
                const index = originalBill.products.findIndex(prd => prd.product._id.toString() === product.product._id.toString());

                // Remove qty from originalBill
                originalBill.products[index].qty -= product.qty;

                // Check if qty === 0, remove product from bill
                if (originalBill.products[index].qty === 0)
                    originalBill.products.splice(index, 1);

                // Remove qty from inventory
                let ingredientsArray = [];
                const prodRef = await Product.findById(product.product._id);

                // Check if product has ingredients
                if (prodRef.ingredients.length === 0) {
                    prodRef.qty -= product.qty;
                    await prodRef.save();
                }
                else {
                    for (let ingredient of prodRef.ingredients) {
                        const ingredientRef = await Ingredient.findById(ingredient.ingredient);

                        ingredientRef.qty -= ingredient.qty * product.qty;
                        await ingredientRef.save();

                        ingredientsArray.push({
                            name: ingredientRef.name,
                            qty: ingredient.qty,
                            price: ingredientRef.sellPrice,
                            ingredientRef: ingredientRef._id
                        });
                    }
                }

                historyProducts.push({
                    name: product.product.name,
                    qty: product.qty,
                    buyPrice: product.product.buyPrice,
                    sellPrice: product.product.sellPrice,
                    productRef: product.product._id,
                    ingredients: ingredientsArray
                });

                historyTotal += product.product.sellPrice * product.qty;
            }

            const data = await recalculateBillTotal(originalBill);

            res.json(data);

            // Add action to history
            await ProductHistory.create({
                user: {
                    name: req.user.name,
                    userRef: req.user._id
                },
                action: 'scrapped',
                table: originalBill.table,
                billNumber: originalBill.number,
                total: historyTotal,
                products: historyProducts
            });

            await updateReport(req, res);

        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/sellProducts', auth, async (req, res) => {
        try {
            const { billToPay, discount } = req.body; // the products we are going to pay from that bill

            if (billToPay.products.length === 0)
                return res.status(404).send('Няма продукти в сметката');

            let historyProducts = [];
            let historyTotal = 0;

            const originalBill = await Bill.findById(billToPay._id).populate('products.product'); // the whole bill
            const table = await Table.findById(originalBill.table);

            for (let product of billToPay.products) { // for every product to pay
                // Find index of product in actuall bill
                const index = originalBill.products.findIndex(prd => prd.product._id.toString() === product.product._id.toString());

                // Remove qty from originalBill
                originalBill.products[index].qty -= product.qty;

                // Check if qty === 0, remove product from bill
                if (originalBill.products[index].qty === 0)
                    originalBill.products.splice(index, 1);

                // Remove qty from inventory
                let ingredientsArray = [];
                const prodRef = await Product.findById(product.product._id);

                // Check if product has ingredients
                if (prodRef.ingredients.length === 0) {
                    prodRef.qty -= product.qty;
                    await prodRef.save();
                }
                else {
                    for (let ingredient of prodRef.ingredients) {
                        const ingredientRef = await Ingredient.findById(ingredient.ingredient);

                        ingredientRef.qty -= ingredient.qty * product.qty;
                        await ingredientRef.save();

                        ingredientsArray.push({
                            name: ingredientRef.name,
                            qty: ingredient.qty,
                            ingredientRef: ingredientRef._id
                        });
                    }
                }

                historyProducts.push({
                    name: product.product.name,
                    qty: product.qty,
                    sellPrice: product.product.sellPrice,
                    buyPrice: product.product.buyPrice,
                    productRef: product.product._id,
                    ingredients: ingredientsArray
                });

                historyTotal += product.product.sellPrice * product.qty;
            }

            if (discount) {
                originalBill.total -= discount;
                historyTotal -= discount;
                if (originalBill.total < 0)
                    originalBill.total = 0;

                if (historyTotal.total < 0)
                    historyTotal = 0;
            }

            const billData = (await recalculateBillTotal(originalBill));

            const historyOptions = {
                user: {
                    name: req.user.name,
                    userRef: req.user._id
                },
                action: 'paid',
                table: originalBill.table,
                billNumber: originalBill.number,
                total: historyTotal,
                products: historyProducts
            }

            if (discount)
                historyOptions.discount = discount;


            // Add action to history
            const history = await ProductHistory.create(historyOptions);

            res.json({ billData, history, tableName: table.name });

            await updateReport(req, res);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/removeOneFromBill', auth, async (req, res) => {
        try {
            const { _id, billId } = req.body;

            // Find bill
            const bill = await Bill.findById(billId).populate('products.product');
            const table = await Table.findById(bill.table);

            // Find product in bill
            for (let [index, product] of Object.entries(bill.products)) {
                if (product.product._id.toString() === _id) {// product.product is actually product._id
                    product.qty--;

                    if (product.qty === 0)
                        bill.products.splice(index, 1); // remove product entirely from bill


                    // Recalculate totals
                    bill.total = 0;
                    if (table) // if normal bill (not consumption)
                        table.total = 0;

                    for (let product of bill.products) {
                        bill.total += product.product.sellPrice * product.qty;
                        if (table) // if normal bill (not consumption)
                            table.total += product.product.sellPrice * product.qty;
                    }

                    await bill.save();
                    if (table) // if normal bill (not consumption)
                        await table.save();

                    return res.json(bill); // Return bill to rerender
                }
            }

            res.status(400).send('Не е намерен такъв продукт в тази сметка!')
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    // NEW: Add all added products together to history
    app.post('/addProductsToHistory', auth, async (req, res) => {
        try {
            const { addedProducts, selectedBillId } = req.body;

            // Validate data
            if (!(addedProducts.length && selectedBillId))
                return res.status(400).send('Всички данни са задължителни!');

            // Check if bill exists
            const bill = await Bill.findById(selectedBillId);
            if (!bill)
                return res.status(400).send('Сметката не съществува!');

            let allActions = {}; // contains arrays of all actions (removed, added, etc.)

            for (let prod of addedProducts) {
                // Check if product exists
                const product = await Product.findById(prod._id);

                if (!product)
                    return res.status(400).send('Продуктът не съществува!');

                // Add to history array
                if (!allActions.hasOwnProperty(prod.action))
                    allActions[prod.action] = [];

                allActions[prod.action].push({
                    name: product.name, // Статично име на продукта (дори да се изтрие от БД няма проблем)
                    qty: prod.selectedX, // Колко бройки сме добавили към масата
                    buyPrice: product.buyPrice,
                    sellPrice: product.sellPrice, // Каква е текущата цена на този продукт (с времето може да се промени)
                    forBartender: product.forBartender, // Дали продуктът е за бармана
                    productRef: product._id // Референция към продукта
                });
            }

            res.send('ok');

            // Add actions to history
            for (let [action, products] of Object.entries(allActions)) {
                let data = {
                    user: {
                        name: req.user.name,
                        userRef: req.user._id
                    },
                    action: action,
                    billNumber: bill.number,
                    products: products // all products that were added
                }

                if (!bill.user)
                    data.table = bill.table;
                await ProductHistory.create(data);
            }

            await updateReport(req, res);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/addProductToBill', auth, async (req, res) => {
        try {
            const { _id, selectedX, selectedBillId } = req.body;

            // _id == product id
            // selectedX == qty
            // selectedBillId == bill _id

            // Validate data
            if (!(_id && selectedX && selectedBillId))
                return res.status(400).send('Всички данни са задължителни!');

            // Check if integer
            if (selectedX % 1 !== 0)
                return res.status(400).send('Бройката трябва да е цяло число!');

            // Check if product exists
            const product = await Product.findById(_id);

            if (!product)
                return res.status(400).send('Продуктът не съществува!');

            // Check if bill exists
            const bill = await Bill.findById(selectedBillId);

            if (!bill)
                return res.status(400).send('Сметката не съществува!');

            const table = await Table.findById(bill.table);

            if (!bill.user && !table)
                return res.status(400).send('Масата не съществува!');

            // Check if this product is already in bill
            let productIndex;

            for (let i = 0; i < bill.products.length; i++) {
                if (bill.products[i].product.toString() === _id) { // if product _id matches
                    productIndex = i; // return index of product in bill.products array and break out of for loop
                    break;
                }
            }

            if (productIndex !== undefined) // found the same product, increase qty
                bill.products[productIndex].qty += selectedX;
            else // couldn't find the same product, create it
                bill.products.push({ product: product._id, qty: selectedX }); // Add reference of product and qty (selectedX) to bill

            // Update bill total
            bill.total += product.sellPrice * selectedX;
            await bill.save(); // Save (because we are editing)

            // Update table total
            if (!bill.user) {
                table.total += product.sellPrice * selectedX;
                await table.save(); // Save (because we are editing)
            }

            await bill.populate('products.product'); // populate products (+ the one we created)

            res.json(bill); // return populated bill so frontend can re-render all products
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/getBillById', auth, async (req, res) => {
        try {
            const { _id } = req.body;

            // Get bill and populate its products
            const bill = await Bill.findById(_id).populate('products.product');

            res.json(bill);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.post('/generateBills', auth, async (req, res) => {
        try {
            // Get selected table id
            const { _id } = req.body;

            if (!(_id))
                return res.status(400).send('Трябва _id на маса!');

            // Check if table exists
            const table = await Table.findById({ _id });

            if (!table)
                return res.status(400).send('Масата не съществува!');

            // Check if this table already has bills initialized
            let bills = await Bill.find({ table: table._id }, ['_id', 'total']).sort({ number: 1 });
            if (bills.length > 0)
                return res.json(bills); // return bills IDS only

            bills = await generateBills(table._id);

            // Done
            res.status(201).json(bills);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.get('/generatePersonalBill', auth, async (req, res) => {
        try {
            // Check if user already has consumption bill
            let bill = await Bill.findOne({ user: req.user._id });

            if (bill)
                return res.json(bill);

            // Else create bill
            bill = await Bill.create({
                user: req.user._id
            });

            res.json(bill);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    async function generateBills(_id) {
        const numberOfBills = 6;
        // Create bills in database
        let emptyArray = [],
            bills;
        for (let i = 1; i < numberOfBills + 1; i++)
            emptyArray.push({ number: i, table: _id }); // generate empty bills with the table ID inside

        bills = await Bill.create(emptyArray);
        return bills;
    }
}