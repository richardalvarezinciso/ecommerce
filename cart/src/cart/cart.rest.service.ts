"use strict";

import * as async from "async";
import * as express from "express";
import { NextFunction } from "express-serve-static-core";
import { RestClient } from "typed-rest-client/RestClient";
import * as rabbit from "../rabbit/rabbit.post.service";
import * as env from "../utils/environment";
import * as error from "../utils/error";
import { IUserSessionRequest } from "../utils/security";
import { Cart, ICart, ICartArticle } from "./cart.schema";


const conf = env.getConfig(process.env);


export interface ICartRequest extends IUserSessionRequest {
    cart: ICart;
}

export interface IValidationResult extends ICartRequest {
    validation: ICartValidation;
}

export interface CartValidationItem {
    articleId: string;
    message: string;
}
export interface ICartValidation {
    errors: CartValidationItem[];
    warnings: CartValidationItem[];
}

export function findCurrentCart(req: ICartRequest, res: express.Response, next: NextFunction) {
    Cart.findOne({
        userId: req.user.user.id,
        enabled: true
    }, function (err: any, cart: ICart) {
        if (err) return error.handleError(res, err);

        req.cart = cart;
        if (!req.cart) {
            req.cart = new Cart();
            req.cart.userId = req.user.user.id;
            req.cart.save(function (err: any) {
                if (err) return error.handleError(res, err);
                next();
            });
        } else {

            req.cart.articles.forEach(article => {
                if (!article.validated) {
                    rabbit.sendArticleValidation(cart._id, article.articleId).then();
                }
            });
            next();
        }
    });
}

export function validateAddArticle(req: ICartRequest, res: express.Response, next: NextFunction) {
    req.check("articleId", "No puede quedar vacío.").notEmpty();
    req.check("quantity", "Debe se numérico").isInt({ min: 1 });

    req.getValidationResult().then(function (result) {
        if (!result.isEmpty()) {
            return error.handleExpressValidationError(res, result);
        }
        next();
    });
}


/**
 * @api {post} /cart/article AddArticle
 * @apiName Add Article
 * @apiGroup Carrito
 *
 * @apiDescription Agregar artículos al carrito.
 *
 * @apiParamasExample {json} Body
 *    {
 *      "articleId": "{Article Id}",
 *      "quantity": {Quantity to add}
 *    }
 *
 * @apiSuccessExample {json} Body
 *    {
 *      "userId": "{User Id}",
 *      "enabled": true|false,
 *      "_id": "{Id de carrito}",
 *      "articles": [{Artículos}],
 *      "updated": "{Fecha ultima actualización}",
 *      "created": "{Fecha creado}"
 *    }
 *
 * @apiUse ParamValidationErrors
 * @apiUse OtherErrors
 */
export function addArticle(req: ICartRequest, res: express.Response) {
    const cart = req.cart;

    const article: ICartArticle = {
        articleId: req.body.articleId,
        quantity: req.body.quantity
    };

    cart.addArticle(article);

    // Save the Cart
    cart.save(function (err: any) {
        if (err) return error.handleError(res, err);

        res.json(cart);
    });
}

/**
 * @api {post} /cart/article/:articleId/decrement DecrementArticleCart
 * @apiName Decrement Article Cart
 * @apiGroup Carrito
 *
 * @apiDescription Decrementa la cantidad de artículos en el cart.
 *
 * @apiSuccessExample {json} Body
 *    {
 *      "articleId": "{Article Id}",
 *      "quantity": {articles to decrement}
 *    }
 *
 * @apiSuccessExample {json} Body
 *    {
 *      "userId": "{User Id}",
 *      "enabled": true|false,
 *      "_id": "{Id de carrito}",
 *      "articles": [{Artículos}],
 *      "updated": "{Fecha ultima actualización}",
 *      "created": "{Fecha creado}"
 *    }
 *
 * @apiUse ParamValidationErrors
 * @apiUse OtherErrors
 */
export function decrementArticle(req: ICartRequest, res: express.Response) {
    const cart = req.cart;
    const articleId = escape(req.params.articleId);

    const article: ICartArticle = {
        articleId: articleId,
        quantity: req.body.quantity
    };

    cart.decrementArticle(article);

    // Save the Cart
    cart.save(function (err: any) {
        if (err) return error.handleError(res, err);

        res.json(cart);
    });
}

/**
 * @api {post} /cart/article/:articleId/increment IncrementArticleCart
 * @apiName Increment Article Cart
 * @apiGroup Carrito
 *
 * @apiDescription Incrementa la cantidad de artículos en el cart.
 *
 * @apiSuccessExample {json} Body
 *    {
 *      "articleId": "{Article Id}",
 *      "quantity": {articles to increment},
 *      "validated": True|False Determina si el articulo se valido en catalog
 *    }
 *
 * @apiSuccessExample {json} Body
 *    {
 *      "userId": "{User Id}",
 *      "enabled": true|false,
 *      "_id": "{Id de carrito}",
 *      "articles": [{Artículos}],
 *      "updated": "{Fecha ultima actualización}",
 *      "created": "{Fecha creado}"
 *    }
 *
 * @apiUse ParamValidationErrors
 * @apiUse OtherErrors
 */
export function incrementArticle(req: ICartRequest, res: express.Response) {
    const cart = req.cart;
    const articleId = escape(req.params.articleId);

    const article: ICartArticle = {
        articleId: articleId,
        quantity: req.body.quantity
    };

    cart.addArticle(article);

    // Save the Cart
    cart.save(function (err: any) {
        if (err) return error.handleError(res, err);

        res.json(cart);
    });
}

/**
 * @api {get} /cart GetCart
 * @apiName Get Cart
 * @apiGroup Carrito
 *
 * @apiDescription Devuelve el carrito activo.
 *
 * @apiSuccessExample {json} Body
 *    {
 *      "userId": "{User Id}",
 *      "enabled": true|false,
 *      "_id": "{Id de carrito}",
 *      "articles": [{Artículos}],
 *      "updated": "{Fecha ultima actualización}",
 *      "created": "{Fecha creado}"
 *    }
 *
 * @apiUse ParamValidationErrors
 * @apiUse OtherErrors
 */
export function getCurrentCart(req: ICartRequest, res: express.Response) {
    res.json(req.cart);
}

export function validateDelete(req: ICartRequest, res: express.Response, next: NextFunction) {
    next();
}

/**
 * @api {delete} /cart/article/:articleId DeleteCartArticle
 * @apiName Delete Cart
 * @apiGroup Carrito
 *
 * @apiDescription Eliminar un articulo del carrito.
 *
 * @apiSuccessExample {string} Body
 *    HTTP/1.1 200 Ok
 *
 * @apiUse ParamValidationErrors
 * @apiUse OtherErrors
 */
export function deleteArticle(req: ICartRequest, res: express.Response) {
    const cart = req.cart;
    const articleId = escape(req.params.articleId);

    const article: ICartArticle = {
        articleId: articleId,
        quantity: 0
    };

    cart.removeArticle(article);

    // Save the Cart
    cart.save(function (err: any) {
        if (err) return error.handleError(res, err);

        res.send();
    });
}

/**
 * @api {post} /cart/validate ValidateCart
 * @apiName Validate Cart
 * @apiGroup Carrito
 *
 * @apiDescription Realiza una validación completa del cart, para realizar el checkout.
 *
 * @apiSuccessExample {json} Body
 *   {
 *      "errors": [
 *          {  "articleId": "{Article}",
 *             "message" : "{Error message}"
 *          }, ...],
 *      "warnings": [
 *          {  "articleId": "{Article}",
 *             "message" : "{Error message}"
 *          }, ...]
 *    }
 *
 * @apiUse ParamValidationErrors
 * @apiUse OtherErrors
 */
export function validateToCheckout(req: IValidationResult, res: express.Response) {
    res.json(req.validation);
}

interface Article {
    "_id": string;
    "name": string;
    "price": number;
    "stock": number;
    "enabled": boolean;
}
/**
 * Esta validación es muy cara porque valida todo contra otros servicios en forma síncrona.
 */
export function validateOrder(req: IValidationResult, res: express.Response, next: NextFunction) {
    async.map(req.cart.articles,
        (article: ICartArticle, callback) => {
            const restClient: RestClient = new RestClient("GetArticle", conf.catalogServer);
            restClient.get<any>("/articles/" + article.articleId,
                { additionalHeaders: { "Authorization": req.user.token } }).then(
                    (data) => {
                        callback(undefined, data.result as Article);
                    }
                ).catch(
                    (exception) => {
                        callback(undefined, { "_id": undefined });
                    }
                );
        },
        (err, results: Article[]) => {
            req.validation = {
                errors: [],
                warnings: []
            };

            req.cart.articles.map((article) => {
                return {
                    article: article,
                    result: results.find(element => element._id == article.articleId)
                };
            }).forEach(element => {
                if (!element.result) {
                    req.validation.errors.push({
                        articleId: element.article.articleId,
                        message: "No se encuentra"
                    });
                } else if (!element.result.enabled) {
                    req.validation.errors.push({
                        articleId: element.article.articleId,
                        message: "Articulo inválido"
                    });
                } else {
                    if (element.result.stock < element.article.quantity) {
                        req.validation.warnings.push({
                            articleId: element.article.articleId,
                            message: "Insuficiente stock"
                        });
                    }
                }
            });

            next();
        });
}

/**
 * @api {post} /cart/checkout CheckoutCart
 * @apiName Checkout Cart
 * @apiGroup Carrito
 *
 * @apiDescription Realiza el checkout del carrito.
 *
 * @apiSuccessExample {string} Body
 *    HTTP/1.1 200 Ok
 *
 * @apiUse ParamValidationErrors
 * @apiUse OtherErrors
 */
export function postOrder(req: ICartRequest, res: express.Response) {
    const cart = req.cart;

    cart.orderId = "orderID";
    cart.enabled = false;
    // Save the Cart
    cart.save(function (err: any) {
        if (err) return error.handleError(res, err);

        res.json(req.cart);
    });
}
