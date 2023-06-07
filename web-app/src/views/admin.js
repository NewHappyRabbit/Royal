import page from 'page';
import { container } from "../app";
import { html, render } from 'lit/html.js';
import $ from "jquery";
import Sortable from 'sortablejs';
import '../css/admin/admin.css';
import { fixPrice, markProductAsScrapped, sortCategories, getProductById, getProductsFromCategory, getAllUsers, editCategory, deleteCategory, deleteUser, createUser, editUser, createCategory, scrapRestockProduct, createProduct, deleteProduct, editProduct, getAllCategories, getAllProducts, sortProducts, logout, getAllIngredients, createIngredient, deleteIngredient, getIngredientById, editIngredient, getAllProductsWithoutIngredients, getProductsWithoutIngredientsFromCategory, scrapRestockIngredient, getAllScrapped, getAllRestockedProducts, getAllReports, getProductsIngredients, getProductSells, getRestockHistory, getNumberOfExpiredProducts, markExpiredAsReviewed, getAllConsumation, saveRevision, getAllRevisions, getInformation } from '../api';

const backBtn = html`<button @click=${() => page('/admin')} class="btn btn-secondary fs-3 mt-2 ms-2">Назад</button>`;
let contentType; //  used in loadProducts to determine if we are loading/deleting a product or ingredient
let selectedProductFromSearch,
    selectedIngredientFromSearch;

let numberOfExpiredProducts;

async function loadProducts(e, showProductsFromIngredients) {
    selectedProductFromSearch = undefined;
    selectedIngredientFromSearch = undefined;

    // Get selected category
    const categoryId = e.target.value;

    let contentToRender;

    if (categoryId === null || categoryId === 'Избери')
        return alert('Избери категория!');

    if (categoryId === 'ingredients') {
        const res = await getAllIngredients();

        contentType = 'ingredient';
        contentToRender = res;
    } else {
        // Get category and render products as options
        const res = await getProductsFromCategory(categoryId);


        if (res.status === 200) {
            contentType = 'product';
            let productsWithoutIngredients = [];

            if (showProductsFromIngredients === false) {
                for (let product of res.data) {
                    if (product.hasOwnProperty('qty'))
                        productsWithoutIngredients.push(product);
                }

                contentToRender = productsWithoutIngredients;
            }
            else
                contentToRender = res.data;
        }
        if (res.status === 400)
            return alert(res.data);
        if (res.status === 500) {
            alert('Възникна грешка!');
            return console.error(res);
        }
    }

    if (!contentToRender.length)
        return alert('Няма продукти в тази категория');

    let renderArray = [];
    for (let content of contentToRender)
        renderArray.push(html`<option unit=${content.unit ? content.unit : 'бр'} value=${content._id}>${content.name} ${content.unit ? `(${content.unit})` : ''}</option>`)

    render(renderArray, document.getElementById('_id'));

    $('#_id').val('Избери'); // Set the selected option to 'Izberi', because it doesnt do it when u render

    // Show div
    $('#product').removeClass('d-none');

    // This is for editProductPage
    // Hide product info div
    $('#product-info').addClass('d-none');
    return contentType;
}

function writeInQty(e) {
    e.preventDefault();
    const what = e.target.innerText.toLowerCase();
    const input = $('#qty');

    if (what === 'x')
        return input.val(input.val().slice(0, -1));

    if (what === '.')
        return $(e.target).addClass('active');

    if (!$('.qty-numpad .dot').hasClass('active'))
        return input.val(`${input.val()}${what}`);

    input.val(`${input.val()}.${what}`);
    $('.qty-numpad .dot').removeClass('active');
}

function showDivs() {
    $('#expireDateDiv').removeClass('d-none');
    $('#quantityDiv').removeClass('d-none');
}

function selectProductFromSearch(e) {
    const selected = e.target.value;

    if (!selected) return;

    const _id = $(`datalist option[value="${selected}"]`).attr('_id');
    const name = $('#productSearch').val();
    const type = $(`datalist option[value="${selected}"]`).attr('type');
    const unit = $(`datalist option[value="${selected}"]`).attr('unit');
    const nameWithoutUnit = name.split(` (${unit}`)[0];


    if (!_id)
        return $('#quantityDiv').addClass('d-none');

    selectedProductFromSearch = {
        _id,
        name,
        nameWithoutUnit,
        type,
        unit
    };

    showDivs();
}

function selectIngredientFromSearch(e) {
    const selected = e.target.value;

    if (!selected) return;

    const _id = $(`datalist option[value="${selected}"]`).attr('_id');

    if (!_id)
        return $('#quantityDiv').addClass('d-none');

    selectedIngredientFromSearch = {
        _id,
        name: selected
    };

    showDivs();
}

const prIngInputs = (prOrIng, categories, type) => html`
    <div class="mb-3">
        <label for="name" class="form-label">Име</label>
        <input required type="text" class="form-control fs-4" value=${prOrIng ? prOrIng.name : ''} name="name" id="name" placeholder="пример: Бира">
    </div>
    ${(prOrIng && prOrIng.unit) || type === 'ingredient'
        ? html`
            <div class="mb-3">
                <label for="unit" class="form-label">Мерна единица</label>
                <select required class="form-control fs-4" name="unit" id="unit">
                    <option ?selected=${!prOrIng} disabled>Избери</option>
                    <option ?selected=${prOrIng ? (prOrIng.unit === 'кг') : false} value="кг">килограм</option>
                    <option ?selected=${prOrIng ? (prOrIng.unit === 'л') : false} value="л">литър</option>
                    <option ?selected=${prOrIng ? (prOrIng.unit === 'бр') : false} value="бр">брой</option>
                </select>
            </div>
        `
        : ''
    }
    ${type !== 'productFromIngredients'
        ? html`
            <div class="mb-3">
                <label for="qty" class="form-label">Количество</label>
                <input required type="number" min=${type === 'ingredient' ? '' : 1} step=${type === 'ingredient' ? 0.000005 : ''} value=${prOrIng ? (type === 'ingredient' && ['кг', 'л'].includes(prOrIng.unit) ? prOrIng.qty / 1000 : prOrIng.qty) : ''} class="form-control fs-4" name="qty" id="qty" placeholder="пример: 50">
            </div>
        `
        : ''
    }
    ${type !== 'productFromIngredients'
        ? html`<div class="mb-3">
                <label for="buyPrice" class="form-label">Доставна цена</label>
                <input required type="text" title="пример: 5.20, 5.0, 5, 0.5, 0.50" value=${prOrIng ? prOrIng.buyPrice : ''} pattern="^\\d{1,}(\\.\\d{1,2})?$" class="form-control fs-4" name="buyPrice" id="buyPrice" placeholder="пример: 1.50">
            </div> 
        `
        : ''
    }
    
    ${type !== 'ingredient'
        ? html`<div class="mb-3">
                    <label for="sellPrice" class="form-label">Продажна цена</label>
                    <input required type="text" title="пример: 5.20, 5.0, 5, 0.5, 0.50" value=${prOrIng ? prOrIng.sellPrice : ''} pattern="^\\d{1,}(\\.\\d{1,2})?$" class="form-control fs-4" name="sellPrice" id="sellPrice" placeholder="пример: 2">
                </div>
        `
        : ''
    }
    
    ${categories || ['product', 'productFromIngredients'].includes(type) ?
        html`
            <div class="mb-3">
                <label for="pr-categoryId" class="form-label">Категория</label>
                <select required type="text" class="form-control fs-4" name="pr-categoryId" id="pr-categoryId">
                    <option selected disabled>Избери</option>
                    ${categories.map((category) => html`<option value=${category._id}>${category.name}</option>`)}
                </select>
            </div>
        `
        : ''
    }
    ${['product', 'productFromIngredients'].includes(type)
        ? html`
            <div class="mb-3">
                <label class="form-label">Да се появява на монитора на</label>
                <div class="form-check">
                    <div class="d-inline-block">
                        <input class="form-check-input" type="checkbox" value="true" name="forBartender" id="forBartender">
                        <label class="form-check-label" for="forBartender">
                            Барман
                        </label>
                    </div>
                </div>
            </div>
        `
        : ''
    }

    ${type === 'productFromIngredients'
        ? html`
            <div class="mb-5 pt-3" id="ingredients">
                <label class="form-label fs-3">Избери съставки</label>
                <div id="selectedIngredients"></div>
                <button type="button" class="btn btn-success fs-3" data-bs-toggle="modal" data-bs-target="#addIngredientModal">Добави съставка</button>
            </div>
        `
        : ''
    }
`;

let addedIngredients = [];

const addIngredientModal = (ingredients) => html`
        <div class="modal fade" id="addIngredientModal" tabindex="-1" aria-labelledby="addIngredientModal" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-fullscreen-sm-down modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fs-4" id="exampleModalLabel">Добави съставка</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body fs-4 text-center">
                        <div class="mb-3">
                            <label for="ingredientSearch" class="form-label">Търси</label>
                            <input @change=${selectIngredientFromSearch} class="form-control fs-4" type="text" list="allingredients" name="ingredientSearch" id="ingredientSearch">
                            <datalist id="allingredients">
                                ${ingredients.map(el => {
    return html`<option type="ingredients" unit=${el.unit} _id=${el._id} name=${el.name} value=${el.name + ` (${el.unit})`} />`
})}
                            </datalist>
                        </div>
                        <div class="mb-3">
                            <label for="ingredientSelect" class="form-label">или избери</label>
                            <select type="text" class="form-control fs-4" name="ingredientSelect" id="ingredientSelect">
                                <option selected disabled>Избери</option>
                                ${ingredients.map((ingredient) => html`<option value=${ingredient._id}>${ingredient.name}</option>`)}
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary fs-4" data-bs-dismiss="modal">Затвори</button>
                        <button @click=${addIngredient} type="button" data-bs-dismiss="modal" class="btn btn-primary fs-4">Добави</button>
                    </div>
                </div>
            </div>
        </div>
`;

function addIngredient() {
    let ingredient = {};
    const fromSelect = {
        _id: $('#ingredientSelect').val(),
        name: $('#ingredientSelect option:selected').text(),
    }

    if (!fromSelect._id && !selectedIngredientFromSearch)
        return alert('Избери съставка!');

    if (fromSelect._id) {
        ingredient._id = fromSelect._id;
        ingredient.name = fromSelect.name;
    } else {
        ingredient._id = selectedIngredientFromSearch._id;
        ingredient.name = selectedIngredientFromSearch.name;
    }

    // Check if already added to ingredients
    for (let el of addedIngredients) {
        if (el._id === ingredient._id) {
            return alert('Съставката вече е добавена!');
        }
    }

    addedIngredients.push(ingredient);

    // Rerender    
    render(ingredientsTemplate(), document.getElementById('selectedIngredients'));
}

const ingredientsTemplate = () => html`
        ${addedIngredients.map(ingredient => {
    return html`
                    <div class="mb-3">
                        <label for=${ingredient._id} class="form-label">${ingredient.name}</label>
                        <input type="number" value=${ingredient.qty} class="form-control fs-4" name="ingredients" id=${ingredient._id} placeholder="пример: 50">
                    </div>
                `;
})
    }
`;

export async function scrapRestockProductPage(ctx) {
    // Check if coming for restock or scrapping
    const action = ctx.path.includes('restock') ? 'restock' : 'scrap';
    const categories = await getAllCategories(true);
    const allProducts = await getAllProductsWithoutIngredients();
    const allIngredients = await getAllIngredients();

    async function scrapRestock(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        let qty = +formData.get('qty'),
            expireDate = formData.get('expireDate'),
            selectedCategory,
            _id;

        // Check if selected using select or search
        if (selectedProductFromSearch) {
            _id = selectedProductFromSearch._id;
            selectedCategory = selectedProductFromSearch.type;
        } else {
            _id = formData.get('_id');
            selectedCategory = formData.get('categoryId');
        }

        if (_id === null)
            return alert('Избери продукт!');
        if (qty === null)
            return alert('Въведи количество!');

        let res;

        if (selectedCategory === 'ingredients')
            res = await scrapRestockIngredient(_id, qty, action, expireDate);
        else
            res = await scrapRestockProduct(_id, qty, action, expireDate);

        if (res.status === 200) {// Successfully added qty to product
            alert(res.data);

            // Clear all inputs and hide divs
            $('#product').addClass('d-none');
            $('#quantityDiv').addClass('d-none');
            $('#expireDateDiv').addClass('d-none');

            $('#productSearch').val(''); // Clear search input
            $('#qty').val(''); // Clear qty input
            $('#expireDate').val(''); // Clear expire date input

            if (!selectedProductFromSearch) {
                $('#categoryId').val('Избери'); // Clear category select
                $('#_id').val('Избери'); // Clear product select
            }

            selectedProductFromSearch = undefined;
        }
        else if (res.status === 400)
            alert(res.data);
        else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const template = () => html`
        ${backBtn}
        <form @submit=${scrapRestock} class="d-flex text-center fs-3 flex-column m-auto mt-5 gap-5 p-3">
            <div class="mb-3 p-3">
                <label for="productSearch" class="form-label">Търси</label>
                <input @change=${selectProductFromSearch} class="form-control fs-4" type="text" list="allproducts" name="productSearch" id="productSearch">
                <datalist id="allproducts">
                    ${allIngredients.map(el => {
        return html`<option type="ingredients" unit=${el.unit} _id=${el._id} value=${el.name + ` (${el.unit})`} />`
    })}
                    ${allProducts.map(el => {
        return html`<option type="product" _id=${el._id} value=${el.name}/>`
    })}
                </datalist>
            </div>

            <div class="mb-3">
                <label for="categoryId" class="form-label">или избери категория</label>
                <select @change=${(e) => loadProducts(e, false)} required type="text" class="form-control fs-4" name="categoryId" id="categoryId">
                    <option selected disabled>Избери</option>
                    <option value="ingredients">Съставки</option>
                    ${categories.map((category) => html`<option value=${category._id}>${category.name}</option>`)}
                </select>
            </div>

            <div class="mb-3 d-none" id="product">
                <label for="_id" class="form-label">Избери продукт</label>
                <select @change=${showDivs} required type="text" class="form-control fs-4" name="_id" id="_id">
                    <option selected disabled>Избери</option>
                </select>
            </div>
            
            <div class="mb-3 d-none" id="quantityDiv">
                <label for="qty" class="form-label">Количество</label>
                <input required type="number" step="0.000005" class="form-control fs-4" name="qty" id="qty" placeholder="пример: 50">
                <div class="w-50 m-auto qty-numpad mt-3 d-none d-lg-grid">
                    <button @click=${writeInQty} class="btn btn-primary">1</button>
                    <button @click=${writeInQty} class="btn btn-primary">2</button>
                    <button @click=${writeInQty} class="btn btn-primary">3</button>
                    <button @click=${writeInQty} class="btn btn-primary">4</button>
                    <button @click=${writeInQty} class="btn btn-primary">5</button>
                    <button @click=${writeInQty} class="btn btn-primary">6</button>
                    <button @click=${writeInQty} class="btn btn-primary">7</button>
                    <button @click=${writeInQty} class="btn btn-primary">8</button>
                    <button @click=${writeInQty} class="btn btn-primary">9</button>
                    <button @click=${writeInQty} class="btn btn-danger">X</button>
                    <button @click=${writeInQty} class="btn btn-primary">0</button>
                    <button @click=${writeInQty} class="btn btn-primary dot">.</button>
                </div>
            </div>

            <div class="mb-3 d-none" id="expireDateDiv">
                <label for="expireDate" class="form-label">Дата</label>
                <input name="expireDate" class="form-control fs-4" id="expireDate" type="date"/>
            </div>
            ${action === 'restock'
            ? html`<input class="btn btn-primary fs-3" type="submit" value="Зареди" />`
            : html`<input class="btn btn-danger fs-3" type="submit" value="Бракувай" />`
        }
            
        </form>
    `;

    render(template(), container);
}

export async function createProductPage() {
    const categories = await getAllCategories(); // CHANGE TO TRUE WHEN READY FOR ADDONS
    const ingredients = await getAllIngredients();
    addedIngredients = [];

    async function createPrdct(e) {
        e.preventDefault();

        // Get data from form
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const qty = +formData.get('qty');
        const buyPrice = +formData.get('buyPrice');
        const sellPrice = +formData.get('sellPrice');
        const categoryId = formData.get('pr-categoryId');
        const forBartender = formData.get('forBartender') || false;

        if (categoryId === null)
            return alert('Избери категория!');

        const res = await createProduct(name, qty, undefined, buyPrice, sellPrice, categoryId, forBartender);

        if (res.status === 201) {// Successfully created product
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    async function createPrdctFromIngrdnts(e) {
        e.preventDefault();

        // Get data from form
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const buyPrice = +formData.get('buyPrice');
        const sellPrice = +formData.get('sellPrice');
        const categoryId = formData.get('pr-categoryId');
        const forBartender = formData.get('forBartender') || false;
        const allIngredients = document.querySelectorAll('input[name="ingredients"]');
        let selectedIngredients = [];

        for (let ingredient of allIngredients) {
            if (ingredient.value) {
                selectedIngredients.push({
                    ingredient: ingredient.id,
                    qty: +ingredient.value
                });
            }
        }

        if (categoryId === null)
            return alert('Избери категория!');

        if (!selectedIngredients.length) // if no ingredients selected
            return alert('Добави поне една съставка!');

        const res = await createProduct(name, undefined, selectedIngredients, buyPrice, sellPrice, categoryId, forBartender);

        if (res.status === 201) {// Successfully created product
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    async function createIngrdnt(e) {
        e.preventDefault();
        // Get data from form
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const unit = formData.get('unit');
        if (unit === undefined || unit === 'Избери')
            return alert('Избери мерна единица!');
        const qty = +formData.get('qty');
        const buyPrice = +formData.get('buyPrice');

        const res = await createIngredient(name, unit, qty, buyPrice);

        if (res.status === 201) {// Successfully created ingredient
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    function selectProductType(e) {
        const selected = $(e.target).val();

        if (!selected || selected === 'Избери')
            return alert('Избери тип!');

        if (selected === 'product') // Render product fields
            render(productFields(), container);
        else if (selected === 'productFromIngredients')
            render(productFromIngredientsFields(), container);
        else if (selected === 'ingredient')
            render(ingredientFields(), container);
    }

    const typeSelect = () => html`
        ${backBtn}
        <div class="mb-3 p-3">
            <label for="productType" class="form-label">Тип на продукт</label>
            <select @change=${selectProductType} required class="form-control fs-4" name="productType" id="productType">
                <option selected disabled>Избери</option>
                <option value="product">Продукт</option>
                <option value="productFromIngredients">Продукт от съставки</option>
                <option value="ingredient">Съставка</option>
            </select>
        </div>
    `;

    const productFields = () => html`
    ${backBtn}
    <form @submit=${createPrdct} class="m-auto mt-2 p-3 text-center fs-3">
        <div class="mb-3">
            <label for="productType" class="form-label">Тип на продукт</label>
            <select @change=${selectProductType} required class="form-control fs-4" name="productType" id="productType">
                <option disabled>Избери</option>
                <option selected value="product">Продукт</option>
                <option value="productFromIngredients">Продукт от съставки</option>
                <option value="ingredient">Съставка</option>
            </select>
        </div>
        ${prIngInputs(undefined, categories, 'product')}
        <input type="submit" class="btn btn-primary fs-3 w-100" value="Създай"/>
    </form>
    `;

    const ingredientFields = () => html`
    ${backBtn}
    <form @submit=${createIngrdnt} class="m-auto mt-2 p-3 text-center fs-3">
        <div class="mb-3">
            <label for="productType" class="form-label">Тип на продукт</label>
            <select @change=${selectProductType} required class="form-control fs-4" name="productType" id="productType">
                <option disabled>Избери</option>
                <option value="product">Продукт</option>
                <option value="productFromIngredients">Продукт от съставки</option>
                <option selected value="ingredient">Съставка</option>
            </select>
        </div>
        ${prIngInputs(undefined, undefined, 'ingredient')}
        <input type="submit" class="btn btn-primary fs-3 w-100" value="Създай" />
    </form>
    `;

    const productFromIngredientsFields = () => html`
    ${backBtn}
    <form @submit=${createPrdctFromIngrdnts} class="m-auto mt-2 p-3 text-center fs-3">
        <div class="mb-3">
            <label for="productType" class="form-label">Тип на продукт</label>
            <select @change=${selectProductType} required class="form-control fs-4" name="productType" id="productType">
                <option disabled>Избери</option>
                <option value="product">Продукт</option>
                <option selected value="productFromIngredients">Продукт от съставки</option>
                <option value="ingredient">Съставка</option>
            </select>
        </div>
        ${prIngInputs(undefined, categories, 'productFromIngredients')}
        <input type="submit" class="btn btn-primary fs-3 w-100" value="Създай" />
    </form>
    ${addIngredientModal(ingredients)}
    `;

    render(typeSelect(), container);
}

export async function deleteProductPage() {
    const categories = await getAllCategories();
    const allProducts = await getAllProducts();
    const allIngredients = await getAllIngredients();

    async function delProduct(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        let _id,
            selectedCategory;

        // Check if selected using select or search
        if (selectedProductFromSearch) {
            _id = selectedProductFromSearch._id;
            selectedCategory = selectedProductFromSearch.type;
        } else {
            _id = formData.get('_id');
            selectedCategory = formData.get('categoryId');
        }

        if (_id === null)
            return alert('Избери продукт!');

        let res;
        if (selectedCategory === 'ingredients')
            res = await deleteIngredient(_id);
        else
            res = await deleteProduct(_id);

        if (res.status === 200) {// Successfully deleted product/ingredient
            //TODO EMIT HERE 'product:deleted' and implement it everywhere
            alert(res.data);
            page('/');
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const deleteTemplate = () => html`
        ${backBtn}
        <form @submit=${delProduct} class="d-flex text-center fs-3 flex-column m-auto mt-5 gap-5 p-3">
            <div class="mb-3">
                <label for="productSearch" class="form-label">Търси</label>
                <input @change=${selectProductFromSearch} class="form-control fs-4" type="text" list="allproducts" name="productSearch" id="productSearch">
                <datalist id="allproducts">
                    ${allIngredients.map(el => {
        return html`<option type="ingredients" unit=${el.unit} _id=${el._id} value=${el.name + ` (${el.unit})`} />`
    })}
                    ${allProducts.map(el => {
        return html`<option type="product" _id=${el._id} value=${el.name}/>`
    })}
                </datalist>
            </div>
            <div class="mb-3">
                <label for="categoryId" class="form-label">или избери категория</label>
                <select @change=${loadProducts} required type="text" class="form-control fs-4" name="categoryId" id="categoryId">
                    <option selected disabled>Избери</option>
                    <option value="ingredients">Съставки</option>
                    ${categories.map((category) => {
        if (category.hasOwnProperty('parent')) // if it has a parent, it means its a subcategory (child)
            return html`<option value=${category._id}>    ${category.name}</option>`

        return html`<option value=${category._id}>${category.name}</option>`
    })}
                </select>
            </div>
            <div class="mb-3 d-none" id="product">
                <label for="_id" class="form-label">Избери продукт</label>
                <select required type="text" class="form-control fs-4" name="_id" id="_id">
                    <option selected disabled>Избери</option>
                </select>
            </div>
            <input class="btn btn-danger fs-3" type="submit" value="Изтрий" />
        </form>
    `;

    render(deleteTemplate(), container);
}

export async function editProductPage(ctx) {
    const categories = await getAllCategories(true);
    const allProducts = await getAllProducts();
    const allIngredients = await getAllIngredients();
    addedIngredients = [];
    selectedIngredientFromSearch = undefined;
    selectedProductFromSearch = undefined;

    async function edtProduct(e) {
        e.preventDefault();
        // Get data from form
        const formData = new FormData(e.target);
        let _id;
        const name = formData.get('name');
        const unit = formData.get('unit');
        let qty = formData.get('qty');
        const buyPrice = +formData.get('buyPrice');
        const sellPrice = +formData.get('sellPrice');
        const allIngredients = document.querySelectorAll('input[name="ingredients"]');

        if (selectedProductFromSearch)
            _id = selectedProductFromSearch._id;
        else
            _id = formData.get('_id');

        let res;

        if (contentType === 'ingredient') {
            qty = +qty;

            if (unit === undefined || unit === 'Избери')
                return alert('Избери мерна единица!')

            res = await editIngredient(_id, name, unit, qty, buyPrice, sellPrice)
        } else {
            const categoryId = formData.get('pr-categoryId');
            const forBartender = formData.get('forBartender') || false;
            let selectedIngredients;


            if (categoryId === null)
                return alert('Избери категория!');

            if (qty) // simple product
                qty = +qty;
            else { // product from ingredients
                selectedIngredients = [];
                for (let ingredient of allIngredients) {
                    if (ingredient.value) {
                        selectedIngredients.push({
                            ingredient: ingredient.id,
                            qty: +ingredient.value
                        });
                    }
                }

                if (!selectedIngredients.length) // if no ingredients selected
                    return alert('Избери поне една съставка!');
            }

            res = await editProduct(_id, name, qty, selectedIngredients, buyPrice, sellPrice, categoryId, forBartender);
        }

        if (res.status === 200) {// Successfully edited product/ingredient
            selectedIngredientFromSearch = undefined;
            selectedProductFromSearch = undefined;

            alert(res.data);
            page('/');
            page(ctx.path); // redirect back here
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    async function loadProductInfo(e) {
        let _id;

        if (e.target.id === 'productSearch') {
            _id = $(`datalist option[value="${e.target.value}"]`).attr('_id');
            contentType = $(`datalist option[value="${e.target.value}"]`).attr('type') === 'ingredients' ? 'ingredient' : 'product';
            selectedProductFromSearch = {
                _id
            }
        }
        else
            _id = e.target.value;

        $('#product-info').removeClass('d-none');

        if (_id === null || _id === 'Избери')
            return alert('Избери категория!');



        if (contentType === 'ingredient') {
            const res = await getIngredientById(_id);
            const ingredient = res.data;

            render(prIngInputs(ingredient, undefined, 'ingredient'), document.getElementById('product-info'))
        }
        else {
            const res = await getProductById(_id);
            if (res.status === 200) {
                const product = res.data;

                // Check if product is made of ingredients or if its simple product
                if (product.ingredients.length) {
                    // Render product first
                    render(prIngInputs(product, categories, 'productFromIngredients'), document.getElementById('product-info'));

                    // Get products ingredients ids, names and qty
                    const res = await getProductsIngredients(_id);

                    if (res.status === 200) {
                        const ingredients = res.data;

                        addedIngredients = [];
                        for (let ingredient of ingredients)
                            addedIngredients.push({ _id: ingredient.ingredient._id, name: ingredient.ingredient.name, qty: ingredient.qty });

                        // Render ingredients
                        render(ingredientsTemplate(), document.getElementById('selectedIngredients'));
                    } else {
                        console.error(res);
                        return alert('Възникна грешка!');
                    }
                }
                else
                    render(prIngInputs(product, categories, 'product'), document.getElementById('product-info'));

                $('#forBartender').attr('checked', product.forBartender);
                $('#pr-categoryId').val(product.category);
            }
        }
    }

    const formTemplate = () => html`
    ${backBtn}
    <form @submit=${edtProduct} class="m-auto p-3 text-center fs-3">
        <div class="mb-3">
                <label for="productSearch" class="form-label">Търси</label>
                <input @change=${loadProductInfo} class="form-control fs-4" type="text" list="allproducts" name="productSearch" id="productSearch">
                <datalist id="allproducts">
                    ${allIngredients.map(el => {
        return html`<option type="ingredients" _id=${el._id} value=${el.name + ` (${el.unit})`} />`
    })}
                    ${allProducts.map(el => {
        return html`<option type="product" _id=${el._id} value=${el.name}/>`
    })}
                </datalist>
        </div>

        <div class="mb-3">
            <label for="categoryId" class="form-label">или избери категория</label>
            <select @change=${(e) => loadProducts(e, true)} required type="text" class="form-control fs-4" name="categoryId" id="categoryId">
                <option selected disabled>Избери</option>
                <option value="ingredients">Съставки</option>
                ${categories.map((category) => html`<option value=${category._id}>${category.name}</option>`)}
            </select>
        </div>

        <div class="mb-3 d-none" id="product">
            <label for="_id" class="form-label">Избери продукт</label>
            <select @change=${loadProductInfo} required type="text" class="form-control fs-4" name="_id" id="_id">
                <option selected disabled>Избери</option>
            </select>
        </div>

        <div id="product-info" class="mb-3 d-none"></div>
        ${addIngredientModal(allIngredients)}
        <input type="submit" class="btn btn-primary mt-3 fs-3 w-100" value="Промени"/>
    </form>
    `;

    render(formTemplate(), container);
}

export async function sortProductsPage() {
    const categories = await getAllCategories(true);

    async function saveOrder() {
        const sortedProducts = sortable.toArray(); // returns array with the 'data-id' attr for sorted categories

        if (sortedProducts === null) return;

        const res = await sortProducts(sortedProducts);

        if (res.status === 200) {// Successfully sorted products
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    async function getProducts(e) {
        const _id = e.target.value; // get selected category id

        if (_id === null || _id === 'Избери')
            return alert('Избери категория!');

        const res = await getProductsFromCategory(_id);
        const products = res.data;



        render(productsTemplate(products), document.getElementById('products'));// render all products in sorting div
    }

    const productsTemplate = (products) => html`
        ${products.map((product) => html`<li class="list-group-item cursor-pointer" data-id=${product._id}>${product.name}</li>
        `)}
    `;

    const reorderDiv = () => html`
        ${backBtn}

        <div class="mt-3 fs-4 text-center">
            <label for="categoryId" class="form-label">Избери категория</label>
            <select @change=${getProducts} required type="text" class="form-control fs-4" name="categoryId" id="categoryId">
                <option selected disabled>Избери</option>
                ${categories.map((category) => {
        if (category.hasOwnProperty('parent')) // if it has a parent, it means its a subcategory (child)
            return html`<option value=${category._id}>    ${category.name}</option>`

        return html`<option value=${category._id}>${category.name}</option>`
    })}
            </select>
        </div>

        <div id="listAndBtn" class="mt-3 p-3 fs-3 text-center">
            <ul id="products" style="width: 80%" class="list-group fs-4 text-center mt-4">
                
            </ul>
            <button @click=${saveOrder} class="btn btn-primary mt-5 w-100 fs-3">Запази</button>
        </div>
    `;

    render(reorderDiv(), container);
    // Activate the sorting http://sortablejs.github.io/Sortable/#simple-list
    var list = document.getElementById('products');
    var sortable = new Sortable(list, {
        animation: 150,
        ghostClass: "active",  // Class name for the drop placeholder
        chosenClass: "list-group-item-action",  // Class name for the chosen item
    })
}

export function createEmployeePage() {
    async function getDataFromForm(e) {
        e.preventDefault();
        // Get data from form
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const pin = formData.get('pin');
        const role = formData.get('role');

        if (role === null)
            return alert('Избери длъжност');

        const res = await createUser(name, pin, role);

        if (res.status === 201) {// Successfully created new user
            alert(res.data);
            page('/');
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const newTemplate = () => html`
        ${backBtn}
        <form autocomplete="off" @submit=${getDataFromForm} class="d-flex m-auto mt-5 flex-column gap-5 p-3 fs-3">
            <div class="text-center">
                <label class="form-label">Име на служител</label>
                <input class="form-control fs-3" name="name" required type="text" placeholder="пример: Иван" />
            </div>
        
            <div class="text-center">
                <label class="form-label">ПИН код (4 цифри)</label>
                <input class="form-control fs-3" name="pin" title="Задължително 4 цифри!" pattern="\\d{4}" maxlength="4"
                    required type="text" placeholder="пример: 1234" />
            </div>
            <div class="d-flex flex-column gap-2 text-center">
                <label class="form-label">Длъжност на служител</label>
                <select class="form-control fs-3" required name="role">
                    <option selected disabled>Избери</option>
                    <option value="bartender">Барман</option>
                    <option value="waiter">Сервитьор</option>
                </select>
            </div>
        
            <input class="btn btn-primary fs-3" type="submit" value="Създай служител" />
        </form>
    `;

    render(newTemplate(), container);
}

export async function deleteEmployeePage() {
    // Get users from Node JS
    let users = await getAllUsers();

    async function delUser(e) {
        e.preventDefault();
        // Get selected user
        const formData = new FormData(e.target);
        const _id = formData.get('_id');

        if (_id === null)
            return alert('Избери служител!');

        const res = await deleteUser(_id);

        if (res.status === 200) {// Successfully deleted user
            alert(res.data);
            page('/');
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const deleteTemplate = () => html`
        ${backBtn}
        <form @submit=${delUser} class="d-flex text-center fs-3 flex-column m-auto mt-5 gap-5 p-3">
            <div>
                <label class="form-label">Избери служител</label>
                <select required class="form-control fs-4 text-capitalize" name="_id">
                    <option selected disabled>Избери</option>
                    ${users.map((user) => html`<option value=${user._id}>${user.name}</option>`)}
                </select>
            </div>
            <input class="btn btn-danger fs-3" type="submit" value="Изтрий" />
        </form>
    `;

    render(deleteTemplate(), container);
}

export async function editEmployeePage() {
    // Get users from Node JS
    let users = await getAllUsers();
    let selectedChange = null,
        lastSelectedChange;

    async function edtUser(e) {
        e.preventDefault();
        // Get selected user
        const formData = new FormData(e.target);
        const newValue = formData.get(selectedChange);
        const _id = formData.get('_id');


        if (_id === null)
            return alert('Избери служител!');
        if (selectedChange === null)
            return alert('Избери какво да промениш!');
        if (!newValue)
            return alert('Въведи нова стойност!');

        const res = await editUser(_id, selectedChange, newValue);

        if (res.status === 200) {// Successfully edited user
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        }
        else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    function showDiv(e) {
        lastSelectedChange = selectedChange;
        selectedChange = $(e.target).val();

        // Show new DIV
        $(`#new${selectedChange}`).toggleClass('d-none');
        $(`#new${selectedChange}`).prop('required', true);

        // Hide old DIV
        if (lastSelectedChange) {
            $(`#new${lastSelectedChange}`).toggleClass('d-none');
            $(`#new${lastSelectedChange}`).prop('required', false);
        }
    }

    const editTemplate = () => html`
        ${backBtn}
        <form autocomplete="off" @submit=${edtUser} class="d-flex text-center fs-3 flex-column m-auto mt-5 gap-5 p-3">
            <div>
                <label class="form-label">1. Избери служител</label>
                <select required class="form-control text-capitalize fs-4" name="_id">
                    <option selected disabled>Избери</option>
                    ${users.map((user) => html`<option value=${user._id}>${user.name}</option>`)}
                </select>
            </div>
        
            <div>
                <label class="form-label">2. Избери какво да промениш</label>
                <select @change=${showDiv} required class="form-control fs-4" name="change">
                    <option selected disabled>Избери</option>
                    <option value="name">Име</option>
                    <option value="pin">ПИН</option>
                    <option value="role">Длъжност</option>
                </select>
            </div>

            <div id="newpin" class="text-center d-none">
                <label class="form-label">3. Въведи нов ПИН (4 цифри)</label>
                <input class="form-control fs-4" name="pin" title="Задължително 4 цифри!" pattern="\\d{4}" maxlength="4" type="text"
                    placeholder="пример: 1234" />
            </div>

            <div id="newname" class="text-center d-none">
                <label class="form-label">3. Въведи ново име</label>
                <input class="form-control fs-4" name="name" type="text" placeholder="пример: Иван" />
            </div>

            <div id="newrole" class="d-flex flex-column gap-2 text-center d-none">
                <label class="form-label">3. Въведи нова длъжност</label>
                <select class="form-control fs-4" name="role">
                    <option selected disabled>Избери</option>
                    <option value="bartender">Барман</option>
                    <option value="waiter">Сервитьор</option>
                </select>
            </div>

            <input class="btn btn-primary fs-3" type="submit" value="Промени" />
        </form>
    `;

    render(editTemplate(), container);
}

export async function createCategoryPage() {
    async function getData(e) {
        e.preventDefault();
        // Get data from form
        const formData = new FormData(e.target);
        const name = formData.get('name');

        const res = await createCategory(name);

        if (res.status === 200) {// Successfully created category
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const categoryFields = () => html`
    ${backBtn}
    <form @submit=${getData} class="m-auto mt-5 p-3 text-center fs-3">
        <div class="mb-3">
            <label for="name" class="form-label">Въведи име</label>
            <input required type="text" class="form-control fs-4" name="name" id="name" placeholder="пример: Безалкохолни">
        </div>
        <input type="submit" class="btn btn-primary fs-3 w-100" value="Създай" />
    </form>
`;

    render(categoryFields(), container);
}

export async function deleteCategoryPage() {
    const categories = await getAllCategories();
    async function delCategory(e) {
        e.preventDefault();
        const confirmAction = confirm('ВНИМАНИЕ! Това ще изтрие тази категория и всички продукти в нея! Сигурен ли си че искаш да продължиш?');

        if (!confirmAction) return;
        // Get selected category
        const formData = new FormData(e.target);
        const _id = formData.get('_id');

        if (_id === null)
            return alert('Избери категория!');

        const res = await deleteCategory(_id);

        if (res.status === 200) {// Successfully deleted category
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const categoryFields = () => html`
    ${backBtn}
    <form @submit=${delCategory} class="m-auto mt-5 p-3 text-center fs-3">
        <div class="mb-3">
            <label for="selected" class="form-label">Избери категория</label>
            <select required type="text" class="form-control fs-4" name="_id" id="selected">
                <option selected disabled>Избери</option>
                ${categories.map((category) => html`<option value=${category._id}>${category.name}</option>`)}
            </select>
        </div>
        <input type="submit" class="btn btn-danger fs-3 w-100" value="Изтрий" />
    </form>
`;

    render(categoryFields(), container);
}

export async function editCategoryPage() {
    const categories = await getAllCategories(true);
    async function edCategory(e) {
        e.preventDefault();
        // Get selected category
        const formData = new FormData(e.target);
        const _id = formData.get('_id');
        const name = formData.get('name'); // New name

        if (_id === null)
            return alert('Избери категория!');

        const res = await editCategory(_id, name);

        if (res.status === 200) {// Successfully edited category
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const categoryFields = () => html`
    ${backBtn}
    <form @submit=${edCategory} class="m-auto mt-5 p-3 text-center fs-3">
        <div class="mb-3">
            <label for="selected" class="form-label">1. Избери категория</label>
            <select required type="text" class="form-control fs-4" name="_id" id="selected">
                <option selected disabled>Избери</option>
                ${categories.map((category) => html`<option value=${category._id}>${category.name}</option>`)}
            </select>
        </div>
        <div class="mb-3">
            <label for="name" class="form-label">2. Въведи ново име</label>
            <input required type="text" class="form-control fs-4" name="name" id="name" />
        </div>
        <input type="submit" class="btn btn-primary fs-3 w-100" value="Промени" />
    </form>
`;

    render(categoryFields(), container);
}

export async function sortCategoriesPage() {
    const categories = await getAllCategories();
    async function saveOrder() {
        const sortedCategories = sortable.toArray(); // returns array with the 'data-id' attr for sorted categories

        if (sortedCategories === null) return;

        const res = await sortCategories(sortedCategories);

        if (res.status === 200) {// Successfully sorted categories
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const reorderDiv = () => html`
        ${backBtn}
        
        <div id="listAndBtn" class="p-3 fs-3 text-center">
            <ul id="categories" style="width: 80%" class="list-group fs-4 text-center mt-4">
                ${categories.map((category) => html`<li class="list-group-item cursor-pointer" data-id=${category._id}>
                    ${category.name}</li>`)}
            </ul>
            <button @click=${saveOrder} class="btn btn-primary mt-3 w-100 fs-3">Запази</button>
        </div>
    `;

    render(reorderDiv(), container);
    // Activate the sorting http://sortablejs.github.io/Sortable/#simple-list
    var list = document.getElementById('categories');
    var sortable = new Sortable(list, {
        animation: 150,
        ghostClass: "active",  // Class name for the drop placeholder
        chosenClass: "list-group-item-action",  // Class name for the chosen item
    })
}

export async function informationsPage() {

    const informationsTemplate = () => html`
        ${backBtn}
        
        <div class="d-flex w-100 gap-3 p-3 fs-4">
            <div class="w-50">
                <label for="fromDate" class="form-label">От</label>
                <input @change=${loadInformation} name="fromDate" class="form-control fs-4" id="fromDate" type="date" />
            </div>
        
            <div class="w-50">
                <label for="toDate" class="form-label">До</label>
                <input @change=${loadInformation} name="toDate" class="form-control fs-4" id="toDate" type="date" />
            </div>
        </div>
        
        <div id="informations">
            
        </div>
    `;

    async function loadInformation() {
        const fromDate = $('#fromDate').val();
        const toDate = $('#toDate').val();

        const res = await getInformation(fromDate, toDate);

        console.log(res.data);
        return;

        if (res.status === 200) {
            const reports = res.data;

            // Split reports by date
            let splitReports = {};
            for (let report of reports) {
                // Get date for report
                let date = new Date(report.when);

                // Check if time is between 00:00 and 04:00 hours (if from last night shift)
                if (date.getHours() >= 0 && date.getHours() < 4) {
                    // If true, show it in yesterday row group (set date as -1 day)
                    date.setDate(date.getDate() - 1);
                }

                // Convert to DD-MM-YYYY
                date = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;

                // Check if date already created in splitReports
                if (!splitReports.hasOwnProperty(date)) {
                    splitReports[date] = [];
                }

                // Add report to splitReports
                splitReports[date].push(report);
            }

            // Render reports
            render(totalRowsH(), document.querySelector('#totalAll tbody'));
        } else {
            console.error(res);
            alert('Възникна грешка');
        }
    }

    render(informationsTemplate(), container);
    loadInformation();
}

export async function revisionsPage() {
    const allRevisions = await getAllRevisions();

    // Convert allRevisions to when property to dd.mm.yyyy (HH:MM)
    allRevisions.forEach((revision) => {
        revision.when = new Date(revision.when).toLocaleString('bg-BG');
    });

    function selectedRevision(e) {
        const index = e.target.value;
        // Create a modifiable copy of allRevisions[index] that wont effect the original variable
        const revision = JSON.parse(JSON.stringify(allRevisions[index]));

        render(productRows(revision.products), document.querySelector('tbody'));
    }

    const productRows = (products) => html`
        ${products.map((product) => {
        let unit = 'бр',
            difference = 0,
            cellClass = '';

        if (product.type === 'ingredient') {
            if (product.unit === 'кг' || product.unit === 'л') {
                unit = product.unit;

                product.oldQty /= 1000;

                if (product.hasOwnProperty('newQty')) {
                    product.newQty /= 1000;
                } else {
                    product.newQty = product.oldQty;
                }
            } else {
                if (!product.hasOwnProperty('newQty'))
                    product.newQty = product.oldQty;
            }
        } else if (!product.hasOwnProperty('newQty')) // If product and no new qty
            product.newQty = product.oldQty;


        difference = +(product.newQty - product.oldQty).toFixed(2);

        if (difference > 0) {
            difference = `+${difference}`;
            cellClass = 'table-success';
        } else if (difference < 0)
            cellClass = 'table-danger';

        product.oldQty += ` ${unit}.`
        product.newQty += ` ${unit}.`
        difference += ` ${unit}.`
        return html`
                <tr class=${cellClass}>
                    <!-- <td scope="row">${product.hasOwnProperty('unit') ? 'Съставка' : 'Продукт'}</td> -->
                    <td scope="row">${product.name}</td>
                    <td>${product.oldQty}</td>
                    <td>${product.newQty}</td>
                    <td>${difference}</td>
                </tr>
            `
    })}
    `;

    const revisionTemplate = () => html`
        <div class="d-flex justify-content-between p-2">
            ${backBtn}  
            <button @click=${() => page('/admin/createRevision')} class="btn btn-primary mt-2 fs-3">Нова ревизия</button>
        </div>

        <select @change=${selectedRevision} class="form-control mt-2fs-4">
            <option selected disabled>Избери</option>
            ${allRevisions.map((revision, i) => html`<option value=${i}>${revision.when}</option>`)}
        </select>

        <table class="table table-striped table-dark table-hover text-center mt-2">
            <thead>
                <tr>
                    <!-- <th scope="col">Тип</th> -->
                    <th scope="col">Артикул</th>
                    <th scope="col">Старо</th>
                    <th scope="col">Ново</th>
                    <th scope="col">Разлика</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
    `;

    render(revisionTemplate(), container);
}

export async function createRevisionPage() {
    const products = await getAllProductsWithoutIngredients();
    const ingredients = await getAllIngredients();
    const productsAndIngredients = ingredients.concat(products);

    async function svRevision(e) {
        e.preventDefault();

        // Get all id and value of all input fields 
        const formData = new FormData(e.target);
        const data = [...formData.entries()];
        const revision = data.map(([_id, qty]) => ({ _id, qty }));

        let res;

        res = await saveRevision(revision);

        console.log(res.data);

        if (res.status === 200) {// Successfully created revision
            alert(res.data);
            page('/');
        } else if (res.status === 400) {
            alert(res.data);
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const productRows = (productsAndIngredients) => html`
        ${productsAndIngredients.map((product) => {
        let qty = product.qty,
            name = product.name,
            unit = 'бр';

        if (product.hasOwnProperty('unit') && (product.unit === 'кг' || product.unit === 'л')) {
            qty /= 1000;
            unit = product.unit;
        }

        qty += ` ${unit}.`
        return html`
                <tr>
                    <!-- <td scope="row">${product.unit ? 'Съставка' : 'Продукт'}</td> -->
                    <td scope="row">${name}</td>
                    <td>${qty}</td>
                    <td><input type="number" min=0 step=${product.hasOwnProperty('unit') && (product.unit === 'кг' || product.unit === 'л') ? 0.000005 : ''} class="form-control fs-4" name=${product._id}></td>
                </tr>
            `
    })}
    `;

    const createRevisionTemplate = () => html`
        ${backBtn}    
        <form class="d-flex flex-column align-items-center" @submit=${svRevision}>
            <table class="table table-striped table-dark table-hover text-center mt-2">
                <thead>
                    <tr>
                        <!-- <th scope="col">Тип</th> -->
                        <th scope="col">Артикул</th>
                        <th scope="col">Старо</th>
                        <th scope="col">Ново</th>
                    </tr>
                </thead>
                <tbody>
                        ${productRows(productsAndIngredients)}
                </tbody>
            </table>
            <input class="btn w-auto btn-primary fs-3 mt-2 mb-2 ms-2" type="submit" value="Запази" />
        </form>
    `;

    render(createRevisionTemplate(), container);
}

export async function inventoryPage() {
    const categories = await getAllCategories(true);
    const products = await getAllProductsWithoutIngredients();
    const ingredients = await getAllIngredients();
    const productsAndIngredients = ingredients.concat(products);
    let lastFoundRow;

    let totals = {
        buyPrice: 0,
        sellPrice: 0,
        difference: 0,
    };

    const productRows = (products) => html`
        ${products.map((product) => {
        let qty = product.qty,
            name = product.name,
            unit = 'бр';

        if (product.hasOwnProperty('unit') && (product.unit === 'кг' || product.unit === 'л')) {
            qty /= 1000;
            unit = product.unit;
        }


        let buyTotal = qty * product.buyPrice,
            sellTotal = qty * product.sellPrice,
            difference = product.sellPrice - product.buyPrice,
            differenceTotal = qty * difference;

        totals.buyPrice += buyTotal;
        totals.sellPrice += sellTotal;
        totals.difference += differenceTotal;

        qty += ` ${unit}.`
        return html`
                <tr class="${qty <= 0 ? 'table-danger' : ''}">
                    <td scope="row">${product.unit ? 'Съставка' : 'Продукт'}</td>
                    <td scope="row">${name}</td>
                    <td>${qty}</td>
                    <td>${fixPrice(product.buyPrice)}</td>
                    <td>${fixPrice(buyTotal)}</td>
                    <td>${product.sellPrice ? fixPrice(product.sellPrice) : "-"}</td>
                    <td>${product.sellPrice ? fixPrice(sellTotal) : "-"}</td>
                    <td>${product.sellPrice ? `${fixPrice(difference)} (${((product.sellPrice - product.buyPrice) / product.buyPrice * 100).toFixed(2)}%)` : "-"}</td>
                    <td>${product.sellPrice ? fixPrice(differenceTotal) : "-"}</td>
                </tr>
            `
    })}
        <tr class="table-primary">
            <th colspan="4" class="text-center">Общо: </th>
            <th>${fixPrice(totals.buyPrice)}</th>
            <td></td>
            <th>${fixPrice(totals.sellPrice)}</th>
            <td></td>
            <th>${fixPrice(totals.difference)}</th>
        </tr>
    `;

    async function showProductsFromCategory(e) {
        totals = {
            buyPrice: 0,
            sellPrice: 0,
            difference: 0
        }

        const categoryId = e.target.value;

        let productsToShow = [];

        if (categoryId === 'all') // show all products
            productsToShow = productsAndIngredients;
        else if (categoryId === 'ingredients') // show only ingredients
            productsToShow = ingredients;
        else
            productsToShow = await getProductsWithoutIngredientsFromCategory(categoryId);

        if (productsToShow.length === 0)
            return alert('Няма продукти в избраната категория!')

        render(productRows(productsToShow), document.querySelector('tbody'));
    }

    async function findProduct(e) {
        await selectProductFromSearch(e);

        // Remove the coloring class from the lastFoundRow
        if (lastFoundRow)
            lastFoundRow.removeClass('table-success')

        // Find the row that contains this product
        lastFoundRow = $(`table tbody tr td:contains(${selectedProductFromSearch.nameWithoutUnit})`).closest('tr');

        // Add coloring class
        lastFoundRow.addClass('table-success');

        // Scroll to the row
        lastFoundRow.get(0).scrollIntoView();
    }

    const inventoryTemplate = () => html`
        ${backBtn}

        <div class="mb-3 p-3">
                <label for="productSearch" class="form-label">Търси продукт</label>
                <input @change=${findProduct} class="form-control fs-4" type="text" list="allproducts" name="productSearch" id="productSearch">
                <datalist id="allproducts">
                    ${ingredients.map(el => {
        return html`
                    <option type="ingredients" unit=${el.unit} _id=${el._id} value=${el.name + ` (${el.unit})`} />`
    })}
                    ${products.map(el => {
        return html`<option type="product" _id=${el._id} value=${el.name}/>`
    })}
                </datalist>
        </div>

        <div class="p-3 mb-3 mt-3">
            <label for="selected" class="form-label fs-4">Преглед по категория</label>
            <select @change=${showProductsFromCategory} required type="text" class="form-control fs-4" name="_id" id="selected">
                <option selected value="all">Всички</option>
                <option value="ingredients">Съставки</option>
                ${categories.map((category) => html`<option value=${category._id}>${category.name}</option>`)}
            </select>
        </div>
    
        <table class="table table-striped table-dark table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Тип</th>
                    <th scope="col">Артикул</th>
                    <th scope="col">Количество</th>
                    <th scope="col">Доставна цена</th>
                    <th scope="col">Доставна общо</th>
                    <th scope="col">Продажна цена</th>
                    <th scope="col">Продажна общо</th>
                    <th scope="col">Разлика цена</th>
                    <th scope="col">Разлика общо</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
    `;

    render(inventoryTemplate(), container);

    // Render all products
    render(productRows(productsAndIngredients), document.querySelector('tbody'));
}

export async function reportsPage() {
    let total = 0,
        income = 0,
        scrapped = 0,
        consumed = 0,
        discounts = 0;

    const reportTemplate = (report, dateString, timeString) => html`
        <tr>
            <td scope="row">${dateString}</td>
            <td scope="row">${timeString}</td>
            <td scope="row" class="text-capitalize">${report.user.name}</td>
            <td scope="row">${fixPrice(report.income)}</td>
            <td scope="row">${fixPrice(report.scrapped)}</td>
            <td scope="row">${fixPrice(report.consumed)}</td>
            <td scope="row">${report.discounts ? fixPrice(report.discounts) : '0.00'}</td>
            <td scope="row">${fixPrice(report.total)}</td>
        </tr>
    `;

    const reportsRows = (date) => html`
        ${Object.values(date).map((dailyReports) => {
        let combinedDailyReports = [];
        let todayTotal = 0,
            todayIncome = 0,
            todayScrapped = 0,
            todayDiscounts = 0,
            todayConsumed = 0;


        for (let report of dailyReports) {
            const date = new Date(report.when);
            const dateString = `${date.getDate() > 9 ? date.getDate() : '0' + date.getDate()}.${(date.getMonth() + 1) > 9 ? date.getMonth() + 1 : '0' + (date.getMonth() + 1)}.${date.getFullYear()}`;
            const timeString = `${date.getHours() > 9 ? date.getHours() : '0' + date.getHours()}:${date.getMinutes() > 9 ? date.getMinutes() : '0' + date.getMinutes()}`;

            todayIncome += report.income;
            todayConsumed += report.consumed;
            todayScrapped += report.scrapped;
            todayDiscounts += report.discounts;
            todayTotal += report.income - report.consumed - report.scrapped;

            combinedDailyReports.push(reportTemplate(report, dateString, timeString));
        }

        // Add the total for the day row
        combinedDailyReports.push(html`
                <tr style="border-bottom: 3px solid white" class="table-primary fw-bold">
                    <td scope="row" colspan="3">Общо:</td>
                    <td scope="row">${fixPrice(todayIncome)}</td>
                    <td scope="row">${fixPrice(todayScrapped)}</td>
                    <td scope="row">${fixPrice(todayConsumed)}</td>
                    <td scope="row">${fixPrice(todayDiscounts)}</td>
                    <td scope="row">${fixPrice(todayTotal)}</td>
                </tr>
            `);

        total += todayTotal;
        income += todayIncome;
        consumed += todayConsumed;
        discounts += todayDiscounts;
        scrapped += todayScrapped;

        return combinedDailyReports;
    })}
    `;

    const totalRowsH = () => html`
        <tr class="table-success">
            <td>Приход</td>
            <td>${fixPrice(income)}</td>
        </tr>
        <tr class="table-danger">
            <td>Брак</td>
            <td>${fixPrice(scrapped)}</td>
        </tr>
        <tr class="table-secondary">
            <td>Консумация</td>
            <td>${fixPrice(consumed)}</td>
        </tr>
        <tr class="table-secondary">
            <td>Отстъпки</td>
            <td>${fixPrice(discounts)}</td>
        </tr>
        <tr class="table-primary">
            <td>Общ приход</td>
            <td>${fixPrice(total)}</td>
        </tr>
    `;

    const reportsTemplate = () => html`
        ${backBtn}

        <div class="d-flex w-100 gap-3 p-3 fs-4">
            <div class="w-50">
                <label for="fromDate" class="form-label">От</label>
                <input @change=${loadReports} name="fromDate" class="form-control fs-4" id="fromDate" type="date"/>
            </div>
    
            <div class="w-50">
                <label for="toDate" class="form-label">До</label>
                <input @change=${loadReports} name="toDate" class="form-control fs-4" id="toDate" type="date"/>
            </div>
        </div>

        <table id="totalAll" class="fw-bold mt-4 table fs-b table-dark text-center">
            <thead>
                <tr>
                    <th scope="col" colspan="2">Общо за избран период</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>

        <table id="selectedReports" class="mt-4 table table-striped table-dark table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Дата</th>
                    <th scope="col">Час</th>
                    <th scope="col">Служител</th>
                    <th scope="col">Продажби</th>
                    <th scope="col">Брак</th>
                    <th scope="col">Консумация</th>
                    <th scope="col">Отстъпки</th>
                    <th scope="col">Общ приход<br></th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    async function loadReports() {
        total = 0;
        income = 0;
        scrapped = 0;
        consumed = 0;

        const fromDate = $('#fromDate').val();
        const toDate = $('#toDate').val();

        const res = await getAllReports(fromDate, toDate);

        if (res.status === 200) {
            const reports = res.data;

            // Split reports by date
            let splitReports = {};
            for (let report of reports) {
                // Get date for report
                let date = new Date(report.when);

                // Check if time is between 00:00 and 04:00 hours (if from last night shift)
                if (date.getHours() >= 0 && date.getHours() < 4) {
                    // If true, show it in yesterday row group (set date as -1 day)
                    date.setDate(date.getDate() - 1);
                }

                // Convert to DD-MM-YYYY
                date = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;

                // Check if date already created in splitReports
                if (!splitReports.hasOwnProperty(date)) {
                    splitReports[date] = [];
                }

                // Add report to splitReports
                splitReports[date].push(report);
            }

            // Render reports
            render(reportsRows(splitReports), document.querySelector('#selectedReports tbody'));
            render(totalRowsH(), document.querySelector('#totalAll tbody'));
        } else {
            console.error(res);
            alert('Възникна грешка');
        }
    }

    render(reportsTemplate(), container);
    loadReports();
}

export async function consumationHistoryPage() {
    const users = await getAllUsers();
    let usersTotal = {};

    const rowsTemplate = (consumations) => html`
        ${consumations.map(consumation => {
        const date = new Date(consumation.when);
        const dateString = `${date.getDate() > 9 ? date.getDate() : '0' + date.getDate()}.${(date.getMonth() + 1) > 9 ? date.getMonth() + 1 : '0' + (date.getMonth() + 1)}.${date.getFullYear()}`;
        usersTotal[consumation.user.name] = usersTotal[consumation.user.name] ? usersTotal[consumation.user.name] + consumation.total : consumation.total;

        return html`
                <tr>
                    <td>${dateString}</td>
                    <td class="text-capitalize">${consumation.user.name}</td>
                    <td>
                        ${Object.values(consumation.products).map(product => {
            return html`${product.name} x ${product.qty} бр.<br>`
        })}
                    </td>
                    <td>${fixPrice(consumation.total)}</td>
                </tr>
            `
    })}
    `;

    const allTotals = () => html`
        ${Object.entries(usersTotal).map(user => html`
            <tr>
                <td class="text-capitalize">${user[0]}</td>
                <td>${fixPrice(user[1])}</td>
            </tr>
        `)}
    `;

    async function loadConsumation() {
        usersTotal = {};
        const fromDate = $('#fromDate').val();
        const toDate = $('#toDate').val();
        const user = $('#user').val();

        const res = await getAllConsumation(fromDate, toDate, user);

        if (res.status === 200) {
            const consumations = res.data;

            // Render consumation
            render(rowsTemplate(consumations), document.querySelector('#selectedConsumations tbody'));
            render(allTotals(), document.querySelector('#totalAll tbody'));
        } else {
            console.error(res);
            alert('Възникна грешка');
        }
    }

    const consumationTemplate = () => html`
        ${backBtn}
        
        <div class="d-flex w-100 gap-3 p-3 fs-4 mb-3">
            <div class="w-50">
                <label for="fromDate" class="form-label">От</label>
                <input @change=${loadConsumation} name="fromDate" class="form-control fs-4" id="fromDate" type="date" />
            </div>
        
            <div class="w-50">
                <label for="toDate" class="form-label">До</label>
                <input @change=${loadConsumation} name="toDate" class="form-control fs-4" id="toDate" type="date" />
            </div>
        </div>

        <div class="p-3 fs-4 mb-3">
            <label for="user" class="form-label">Служител</label>
            <select @change=${loadConsumation} class="form-control fs-4 text-capitalize" name="user" id="user">
                <option value="" selected>Всички</option>
                ${users.map(user => html`
                    <option value="${user._id}">${user.name}</option>
                `)}
            </select>
        </div>

        <table id="totalAll" class="mt-4 table fs-b table-dark text-center">
            <thead>
                <tr class="fw-bold">
                    <th scope="col" colspan="2">Общо за избран период</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>

        <table id="selectedConsumations" class="mt-4 table table-striped table-dark table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Дата</th>
                    <th scope="col">Служител</th>
                    <th scope="col">Консумация</th>
                    <th scope="col">Общо</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    render(consumationTemplate(), container);
    loadConsumation();
}

export async function scrappedPage() {
    let allScrapped = await getAllScrapped();

    async function markPrdAsScrapped(e) {
        const _id = e.target.getAttribute('_id'); // history id

        const res = await markProductAsScrapped(_id);

        if (res.status === 200) {
            // Rerender histories
            allScrapped = res.data;
            render(historiesRows(allScrapped), document.querySelector('tbody'));
        } else {
            alert('Възникна грешка!');
            console.error(res);
        }
    }

    const historiesRows = (histories) => html`
        ${histories.map((history) => {
        let allProducts = [];
        let total = 0;
        const date = new Date(history.when);
        const dateString = `${date.getDate() > 9 ? date.getDate() : '0' + date.getDate()}.${(date.getMonth() + 1) > 9 ? date.getMonth() + 1 : '0' + (date.getMonth() + 1)}.${date.getFullYear()}`;
        const timeString = `${date.getHours() > 9 ? date.getHours() : '0' + date.getHours()}:${date.getMinutes() > 9 ? date.getMinutes() : '0' + date.getMinutes()}`;

        for (let product of history.products) {
            total += product.qty * product.sellPrice;
            allProducts.push(html`<div>${product.name} x ${product.qty} бр.</div>`)
        }

        return html`
            <tr>
                <td>${dateString}</td>
                <td>${timeString}</td>
                <td>${history.table.name}</td>
                <td>${history.billNumber}</td>
                <td class="text-capitalize">${history.user.name}</td>
                <td>${allProducts}</td>
                <td>${total.toFixed(2)}</td>
                <td><button @click=${markPrdAsScrapped} class="btn btn-danger" _id=${history._id}>Бракувай</button></td>
            </tr>`
    })}
    `;

    const scrappedTemplate = () => html`
        ${backBtn}
    
        <table class="mt-3 table table-striped table-dark table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Дата</th>
                    <th scope="col">Час</th>
                    <th scope="col">Маса</th>
                    <th scope="col">Сметка</th>
                    <th scope="col">Служител</th>
                    <th scope="col">Артикули</th>
                    <th scope="col">Сума</th>
                    <th scope="col"></th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
    `;

    render(scrappedTemplate(), container);

    // Render all scrapped products
    render(historiesRows(allScrapped), document.querySelector('tbody'));
}

export async function expireProductsPage() {
    const products = await getAllRestockedProducts();

    async function markAsReviewed(_id) {
        const res = await markExpiredAsReviewed(_id);

        if (res.status === 200) {
            // Successfuly marked as reviewed
            numberOfExpiredProducts--;

            $(`#${_id} .expiredBtnCell`).html('');
            $(`#${_id} .expiredDateCell`).removeClass('table-danger');
        } else {
            console.error(res);
            alert('Възникна грешка!');
        }
    }

    const expireTemplate = (products) => html`
        ${backBtn}
    
        <table class="mt-3 table table-striped table-dark table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Дата на зареждане</th>
                    <th scope="col">Артикул</th>
                    <th scope="col">Количество</th>
                    <th scope="col">Срок на годност</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${products.map((product) => {
        let qty = product.product.qty,
            name = product.product.name,
            restockDate = new Date(product.when),
            expireDate = new Date(product.product.expireDate),
            unit = 'бр',
            today = new Date(),
            expired = false;

        expireDate = `${expireDate.getDate() < 10 ? '0' + expireDate.getDate() : expireDate.getDate()}.${(expireDate.getMonth() + 1) < 10 ? '0' + (expireDate.getMonth() + 1) : (expireDate.getMonth() + 1)}.${expireDate.getFullYear()}`;
        restockDate = `${restockDate.getDate() < 10 ? '0' + restockDate.getDate() : restockDate.getDate()}.${(restockDate.getMonth() + 1) < 10 ? '0' + (restockDate.getMonth() + 1) : (restockDate.getMonth() + 1)}.${restockDate.getFullYear()}`;

        if (today > new Date(product.product.expireDate) && product.reviewed === false)
            expired = true;

        if (product.product.hasOwnProperty('unit') && (product.product.unit === 'кг' || product.product.unit === 'л')) {
            qty /= 1000;
            unit = product.product.unit;
        }

        qty += ` ${unit}.`
        return html`
                            <tr id=${product._id} valign="middle">
                                <td>${restockDate}</td>
                                <td>${name}</td>
                                <td>${qty}</td>
                                <td class="expiredDateCell ${expired && 'table-danger'}">${expireDate}</td>
                                <td class="expiredBtnCell">${expired ?
                html`<button @click=${() => markAsReviewed(product._id)} class="btn btn-info fs-5">OK</button>` : ''}</td>
                            </tr>
                        `
    })}
            </tbody>
        </table>
    `;

    render(expireTemplate(products), container);
}

export async function soldProductsPage() {
    const products = await getAllProducts();
    let totals = {
        qty: 0,
        price: 0
    }

    async function loadSells(e) {
        totals.qty = 0;
        totals.price = 0;

        await selectProductFromSearch(e);

        const fromDate = $('#fromDate').val();
        const toDate = $('#toDate').val();

        const res = await getProductSells(fromDate, toDate, selectedProductFromSearch._id);

        if (res.status === 200) {
            const sells = res.data;

            render(sellsRows(sells), document.querySelector('table tbody'));
            render(sellTotal(), document.querySelector('table tfoot'));
        } else {
            console.error(res);
            alert('Възникна грешка!');
        }
    }

    const sellTotal = () => html`
    ${totals.qty > 0
            ? html`
        <tr class="table-primary">
            <td colspan="2"></td>
            <td>Общо:</td>
            <td>${totals.qty} бр.</td>
            <td>${fixPrice(totals.price)}</td>
        </tr>`
            : ''
        }`;

    const sellsRows = (sells) => html`
        ${sells.map((sell) => {
        const date = new Date(sell.when);
        const dateString = `${date.getDate() > 9 ? date.getDate() : '0' + date.getDate()}.${(date.getMonth() + 1) > 9 ? date.getMonth() + 1 : '0' + (date.getMonth() + 1)}.${date.getFullYear()}`;
        const timeString = `${date.getHours() > 9 ? date.getHours() : '0' + date.getHours()}:${date.getMinutes() > 9 ? date.getMinutes() : '0' + date.getMinutes()}`;

        totals.qty += sell.qty;
        totals.price += sell.total;

        return html`
            <tr>
                <td>${dateString}</td>
                <td>${timeString}</td>
                <td>${fixPrice(sell.sellPrice)}</td>
                <td>${sell.qty} бр.</td>
                <td>${fixPrice(sell.total)}</td>
            </tr>`
    })}
    `;

    const soldTemplate = () => html`
        ${backBtn}

        <div class="d-flex w-100 gap-3 p-3 fs-4">
            <div class="w-50">
                <label for="fromDate" class="form-label">От</label>
                <input @change=${loadSells} name="fromDate" class="form-control fs-4" id="fromDate" type="date"/>
            </div>
    
            <div class="w-50">
                <label for="toDate" class="form-label">До</label>
                <input @change=${loadSells} name="toDate" class="form-control fs-4" id="toDate" type="date"/>
            </div>
        </div>

        <div class="mb-3 p-3 fs-4">
                <label for="productSearch" class="form-label">Търси</label>
                <input @change=${loadSells} class="form-control fs-4" type="text" list="allproducts" name="productSearch" id="productSearch">
                <datalist id="allproducts">
                    ${products.map(el => {
        return html`<option type="product" _id=${el._id} value=${el.name}/>`
    })}
                </datalist>
        </div>

        <table class="mt-3 table table-striped table-dark table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Дата</th>
                    <th scope="col">Час</th>
                    <!-- <th scope="col">Артикули</th> -->
                    <th scope="col">Цена</th>
                    <th scope="col">Количество</th>
                    <th scope="col">Сума</th>
                </tr>
            </thead>
            <tbody class="d-table-footer-group"></tbody>
            <tfoot class="fw-bold d-table-footer-group"></tfoot>
        </table>
    `;

    render(soldTemplate(), container);
}

export async function restockHistoryPage() {
    const ingredients = await getAllIngredients();
    const products = await getAllProductsWithoutIngredients();

    async function search(e) {
        // If selected  (else called in render at first load of page)
        if (e)
            await selectProductFromSearch(e);

        const fromDate = $('#fromDate').val();
        const toDate = $('#toDate').val();

        const res = await getRestockHistory(fromDate, toDate, selectedProductFromSearch && selectedProductFromSearch._id, selectedProductFromSearch && selectedProductFromSearch.type);

        if (res.status === 200) {
            const restocks = res.data;

            render(rows(restocks), document.querySelector('table tbody'));
        } else {
            console.error(res);
            alert('Възникна грешка!');
        }
    }

    const rows = (restocks) => html`
        ${restocks.map((restock) => {
        const date = new Date(restock.when);
        const dateString = `${date.getDate() > 9 ? date.getDate() : '0' + date.getDate()}.${(date.getMonth() + 1) > 9 ? date.getMonth() + 1 : '0' + (date.getMonth() + 1)}.${date.getFullYear()}`;
        const timeString = `${date.getHours() > 9 ? date.getHours() : '0' + date.getHours()}:${date.getMinutes() > 9 ? date.getMinutes() : '0' + date.getMinutes()}`;
        let unit = 'бр'

        if (['кг', 'л'].includes(restock.product.unit)) {
            unit = restock.product.unit;
            restock.product.qty /= 1000;
        }

        return html`
            <tr>
                <td>${dateString}</td>
                <td>${timeString}</td>
                <td>${restock.product.name}</td>
                <td>${restock.product.qty} ${unit}.</td>
            </tr>`
    })}
    `;

    const restockTemplate = () => html`
        ${backBtn}

        <div class="d-flex w-100 gap-3 p-3 fs-4">
            <div class="w-50">
                <label for="fromDate" class="form-label">От</label>
                <input @change=${search} name="fromDate" class="form-control fs-4" id="fromDate" type="date"/>
            </div>
    
            <div class="w-50">
                <label for="toDate" class="form-label">До</label>
                <input @change=${search} name="toDate" class="form-control fs-4" id="toDate" type="date"/>
            </div>
        </div>

        <div class="mb-3 p-3 fs-4">
                <label for="productSearch" class="form-label">Търси</label>
                <input @change=${search} class="form-control fs-4" type="text" list="allproducts" name="productSearch" id="productSearch">
                <datalist id="allproducts">
                    ${ingredients.map(el => {
        return html`<option type="ingredients" unit=${el.unit} _id=${el._id} value=${el.name + ` (${el.unit})`} />`
    })}
                    ${products.map(el => {
        return html`<option type="product" _id=${el._id} value=${el.name}/>`
    })}
                </datalist>
        </div>

        <table class="mt-3 table table-striped table-dark table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Дата</th>
                    <th scope="col">Час</th>
                    <th scope="col">Продукт</th>
                    <th scope="col">Количество</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    render(restockTemplate(), container);
    search();
}

export async function showAdminDashboard() {
    if (numberOfExpiredProducts === undefined)
        numberOfExpiredProducts = await getNumberOfExpiredProducts();


    selectedProductFromSearch = undefined;
    selectedIngredientFromSearch = undefined;
    const dashboard = () => html`
        <div class="p-3">
            <div class="text-center mt-4">
                <h1>Специални</h1>
                <div class="d-inline-flex flex-row flex-wrap gap-3 justify-content-center">
                    <button @click=${() => page('/admin/products/sold')} class="btn btn-success fs-4">Продажби</button>
                    <button @click=${() => page('/admin/revisions')} class="btn btn-info fs-4">Ревизии</button>
                    <button @click=${() => page('/admin/consumationHistory')} class="btn btn-secondary fs-4">История на консумация</button>
                    <button @click=${() => page('/admin/restockHistory')} class="btn btn-info fs-4">История на зареждане</button>
                    <button @click=${() => page('/admin/inventory/scrapped')} class="btn btn-danger fs-4">Бракувана стока</button>
                    <button @click=${() => page('/admin/expireProducts')} class="btn btn-primary fs-4 position-relative">
                        Срок на годност
                        <span id="numberOfExpiredProducts" class="${numberOfExpiredProducts === 0 && 'd-none'} position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">${numberOfExpiredProducts}</span>
                    </button>
                    <button @click=${() => page('/admin/inventory')} class="btn btn-secondary fs-4">Склад</button>
                    <button @click=${() => page('/admin/reports')} class="btn btn-secondary fs-4">Отчети</button>
                    <button @click=${() => page('/admin/informations')} class="btn btn-secondary fs-4">Обобщена информация</button>
                </div>
            </div>
            <div class="text-center mt-4">
                <h1>Стока</h1>
                <div class="d-inline-flex flex-row flex-wrap gap-3 justify-content-center">
                    <button @click=${() => page('/admin/product/restock')} class="btn btn-primary fs-4">Зареди</button>
                    <button @click=${() => page('/admin/product/scrap')} class="btn btn-danger fs-4">Бракувай</button>
                    <div class="d-inline-flex flex-row flex-wrap gap-3 justify-content-center">
                        <button @click=${() => page('/admin/product/create')} class="btn btn-success fs-4">Създай</button>
                        <button @click=${() => page('/admin/product/delete')} class="btn btn-danger fs-4">Изтрий</button>
                        <button @click=${() => page('/admin/product/edit')} class="btn btn-secondary fs-4">Редактирай</button>
                        <button @click=${() => page('/admin/product/reorder')} class="btn btn-secondary fs-4">Подреди</button>
                    </div>
                </div>
            </div>
            <div class="text-center mt-4">
                <h1>Категории</h1>
                <div class="d-inline-flex flex-row flex-wrap gap-3 justify-content-center">
                    <button @click=${() => page('/admin/category/create')} class="btn btn-success fs-4">Създай</button>
                    <button @click=${() => page('/admin/category/delete')} class="btn btn-danger fs-4">Изтрий</button>
                    <button @click=${() => page('/admin/category/edit')} class="btn btn-secondary fs-4">Редактирай</button>
                    <button @click=${() => page('/admin/category/reorder')} class="btn btn-secondary fs-4">Подреди</button>
                </div>
            </div>
            <div class="text-center mt-4">
                <h1>Служители</h1>
                <div class="d-inline-flex flex-row flex-wrap gap-3 justify-content-center">
                    <button @click=${() => page('/admin/employee/create')} class="btn btn-success fs-4">Създай</button>
                    <button @click=${() => page('/admin/employee/delete')} class="btn btn-danger fs-4">Изтрий</button>
                    <button @click=${() => page('/admin/employee/edit')} class="btn btn-secondary fs-4">Редактирай</button>
                </div>
            </div>
            <div class="d-flex mt-5 flex-row flex-wrap gap-3 justify-content-end">
                <button @click=${() => page('/waiter')} class="btn btn-secondary fs-4">Маси</button>
                <button @click=${() => page('/bartender')} class="btn btn-secondary fs-4">Поръчки</button>
                <button @click=${logout} class="btn btn-danger fs-4">Изход</button>
            </div>
        </div>
    `;

    render(dashboard(), container);
} 