/// <reference path="typings/tsd.d.ts" />

'use strict';

export interface IFilterFunction {
    (type?: string): boolean;
}

export interface IList<T extends {}> {
    [index: string]: T;
}

export interface IErrorMessage {
    id: number;
    type: string;
    item: IErrorModel;
    name: string;
    label: string;
    message: string;
}

export interface IFilterFn {
    (type: string): boolean;
}

export interface IErrorFilterOptions {
    limit?: number;
    exclude?: string[]|IFilterFn|string;
    filter?: string[]|IFilterFn|string;
}

export interface IErrorScope extends angular.IScope {
    $model: IErrorHelper;
    $errorCount: number;
    $latestHtml: angular.IAugmentedJQuery;
    $firstHtml: angular.IAugmentedJQuery;
    $first: IErrorMessage;
    $latest: IErrorMessage;
    $errors: any[];
    $displaying(): boolean;
    $options: IErrorFilterOptions;
}

export interface IErrorAddOptions {
    scope: angular.IScope;
    el: angular.IAugmentedJQuery;
    name: string;
    group: string;
    controller: angular.INgModelController | angular.IFormController;
    attrs?: angular.IAttributes;
    label?: string;
    parent?: IErrorModel;
    isForm?: boolean;
}

export interface IInterpolatedMessages<T> {
    [index: string]: any;
    types: T;
    add(name: string, expr: any): angular.IInterpolationFunction;
    remove(name: string): IInterpolatedMessages<T>;
    include(url: string): angular.IPromise<T>;
}

export interface IErrorHelper {
    item: IErrorModel;
    error: IErrorGetterSetter;
    set(err: IList<boolean>): angular.IPromise<IErrorMessage[]>;
    label(item: string, name: string): IErrorHelper;
    reset(pick?: any): angular.IPromise<IErrorMessage[]>;
    validity(validity: IList<boolean>): angular.IPromise<IErrorMessage[]>;
    remove(): angular.IPromise<void>;
    validate(): boolean;
}

export interface IErrorModel {
    controller: angular.INgModelController;
    isForm: boolean;
    scope: angular.IScope;
    group: string;
    state: {
        manual: boolean;
        reset: IList<Boolean>;
    };
    destroyed: boolean;
    parent: IErrorModel;
    name: string;
    children: IList<IErrorModel>;
    attrs: angular.IAttributes;
    element: angular.IAugmentedJQuery;
    errors: IErrorMessage[];
    forced: IList<Function|boolean|string>;
    apply: (fn: Function, preferEvalAsync?: boolean) => IErrorModel;
    helpers: IErrorHelper;
}

export interface IErrorModels {
    models: IList<IErrorModel>;
    labels: IList<string>;
}

export interface IErrorGetterSetter {
    (extra?: IList<any>): IErrorMessage[];
    (extra?: boolean): IErrorMessage[];
}

export class ErrorLookupError implements Error {
    name: string;
    message: string;
    stack: any;

    constructor(message: string) {
        var error: any = Error.call(this, message);

        this.name = 'ErrorLookupError';
        this.message = error.message;
        this.stack = error.stack;
    }
}

ErrorLookupError.prototype = Object.create(Error.prototype, {
    constructor: {
        value: ErrorLookupError,
        writable: true,
        configurable: true
    }
});

function viewChangeListener(model: IErrorModel) {
    var skip: boolean, controller:angular.INgModelController;

    if (!controller || !controller.$viewChangeListeners) {
        return;
    }

    controller = model.controller;

    skip = false;

    _.forEach(controller.$viewChangeListeners, (vcl: any) => {
        if (vcl['errorLookup'] === true) {
            skip = true;
        }
    });

    if (!skip) {
        var v: any = () => {
            _.forEach(model.state.reset, (reset, field) => {
                if (typeof controller.$error[field] !== 'undefined') {
                    controller.$setValidity(field, true);
                }
                if (typeof model.forced[field] !== 'undefined') {
                    delete model.forced[field];
                }
            });

            empty(model.state, 'reset');
            model.state.manual = false;

            model.helpers.error();
        };
        v['errorLookup'] = true;

        controller.$viewChangeListeners.push(v);
    }

}

function empty(obj: any, member: string, filter?: Function, del: boolean = false) {
    if (obj) {
        if (del === true) {
            delete obj[member];
        } else {
            if (_.isArray(obj[member])) {
                obj[member].length = 0;
            } else if (_.isPlainObject(obj[member])) {
                _.forEach(obj[member], (v, k) => {
                    if (filter && filter(v,k)) {
                        delete obj[member][k];
                    } else {
                        delete obj[member][k];
                    }
                });
            }
        }
    }
}

export module Services {

    export class ErrorLookup {
        repository: IList<IErrorModels> = {};
        messages: IInterpolatedMessages<IList<angular.IInterpolationFunction>>;
        emptyInterpolated: angular.IInterpolationFunction;
        private incrementalId: number = 0;

        /**
         * Get the translation interpolated function for an error message
         *
         * @example
         *
         * ErrorLookup.translate('required')({
         *   '$value': 'Good lord'
         * })
         */
        translate(type: string): angular.IInterpolationFunction;
        translate(obj: IList<string>): IList<angular.IInterpolationFunction>;
        translate(message: any): any {
            if (_.isString(message)) {
                if (typeof this.messages[message] === 'function') {
                    return this.messages[message];
                } else {
                    throw new ErrorLookupError(`Message ${message} is not defined`);
                }
            } else if (_.isPlainObject(message)) {
                var out: any = {};
                _.forEach(message, (str, key) => {
                    out[key] = this.translate(key);
                });
                return out;
            }

            return this.emptyInterpolated;
        }

        /**
         * Getter/setter for errors, can predefine errors and override them per model
         *
         * @example
         *
         * ErrorLookup.error('group','model')(true); // receives the current errors array without updating it
         * ErrorLookup.error('group','model')(); // Update the errors array and return it
         * ErrorLookup.error('group','model')({required:'override'}); // Override the 'required' error message with the one you specify
         * ErrorLookup.error('group','model')({required: true}); // Update the error to set the 'required' as error, but don't update the ngModel.$error object
         */
        error(group: string, name: string, predefine: any, bypass: any = false): IErrorGetterSetter {
            var
                customMessages: any,
                model: IErrorModel,
                repo: IErrorModels;

            repo = this.repository[group];

            if (!repo) {
                return ():any => [];
            }

            model = repo.models[name];

            if (!model) {
                return ():any => [];
            }

            var fromModel = (model: IErrorModel, key?: string): any => {
                if (key) {
                    var ngModel: any = model;
                    if (ngModel) {
                        if (ngModel.controller && typeof ngModel.controller[key] !== 'undefined') {
                            return ngModel.controller[key];
                        }
                        if (typeof ngModel[key] !== 'undefined') {
                            return ngModel[key];
                        }
                    }
                } else if (model) {
                    if (model.controller) {
                        return model.controller;
                    } else {
                        return model;
                    }
                }
                return '';
            };

            var findName = (e: IErrorModel, retName: boolean = true): string => {
                if (e) {
                    var n: any;

                    if ((n = fromModel(e, '$name'))) {
                        if (repo.labels[n]) {
                            return repo.labels[n];
                        }
                        return n;
                    } else if (repo.labels[name]) {
                        return repo.labels[name];
                    }

                    return _.reduce<IErrorModel, string>(repo.models, (current, model) => {
                        if (model === e) {
                            if (repo.labels[name]) {
                                return repo.labels[name];
                            } else {
                                return name;
                            }
                        }
                    }, '');
                }

                if (retName) {
                    return name;
                } else {
                    return '';
                }
            };

            customMessages = !_.isEmpty(predefine) && _.isPlainObject(predefine);

            var modelByDefinition = (model: angular.INgModelController) => {
                return _.find(repo.models, (m) => {
                    return m.controller === model;
                });
            };

            var predefined = (key: string, model?: IErrorModel): Boolean|Function => {
                var m: any;
                if (customMessages && predefine[key]) {
                    if (_.isString(predefine[key])) {
                        return this.$interpolate(predefine[key]);
                    } else if (_.isFunction(predefine[key])) {
                        return predefine[key];
                    }
                }

                if (model && (m = fromModel(model, '$error'))) {
                    if (m[key] === false) {
                        return false;
                    }
                }

                if (_.isFunction(this.messages.types[key])) {
                    return this.messages.types[key];
                }

                return false;
            };

            var common = (key: string, error: any) => {
                var fn: any, label: any, obj: IErrorMessage;

                if (typeof key === 'undefined' || typeof error === 'undefined') {
                    return;
                }

                if (error === true) {
                    fn = predefined(key);
                } else if (_.isString(error)) {
                    fn = this.$interpolate(error);
                }

                if (fn) {
                    label = findName(model);
                    obj = {
                        id: this.incrementalId++,
                        type: key,
                        item: model,
                        name: name,
                        label: label,
                        message: void 0
                    };

                    obj.message = fn.call(obj, {
                        $label: label,
                        $name: name,
                        $group: model.group,
                        $model: model.controller,
                        $attrs: model.attrs,
                        $value: model.controller.$viewValue,
                        $scope: model.scope,
                        $models: repo.models
                    });

                    model.errors.push(obj);
                }
            };

            return (extra?: any) => {

                if (!model || model.destroyed || !model.controller) {
                    if (_.isArray(model.errors)) {
                        return model.errors;
                    } else {
                        return [];
                    }
                }

                if (extra === true) {
                    return model.errors;
                }

                model.errors.length = 0;
                var errs: IList<Boolean|String>;
                errs = {};

                if (!_.isEmpty(model.controller) && _.isPlainObject(model.controller.$error)) {
                    _.extend(errs, model.controller.$error);
                }

                if (_.isPlainObject(extra)) {
                    _.extend(errs, extra);
                }

                _.forEach(errs, (error, key) => {
                    var fn: any = false;

                    if (model.isForm) {
                        var frm: string = findName(model);
                        var already: any[] = [];

                        _.forEach(error, (e: any) => {
                            var
                                obj: IErrorMessage,
                                label: string;

                            e = modelByDefinition(e);

                            if (!e) {
                                return;
                            }

                            if (_.indexOf(already, e) !== -1) {
                                return;
                            }

                            already.push(e);

                            fn = predefined(key, e);

                            if (fn) {
                                label = findName(e, false);
                                obj = {
                                    id: this.incrementalId++,
                                    type: key,
                                    item: model,
                                    name: fromModel(e, '$name') || frm,
                                    label: label || frm,
                                    message: void 0
                                };

                                obj.message = fn.call(obj, {
                                    $label: label,
                                    $model: fromModel(e),
                                    $group: e.group || model.group || group,
                                    $name: e.name || fromModel(e, '$name'),
                                    $attrs: e.attrs,
                                    $form: model.controller,
                                    $value: fromModel(e, '$viewValue'),
                                    $scope: e.scope || model.scope,
                                    $models: repo.models
                                });

                                model.errors.push(obj);
                            }
                        });

                        already.length = 0;
                    } else {
                        common(key, error);
                    }
                });

                _.forEach(model.forced, (error, key) => {
                    common(key, error);
                });

                return model.errors;
            };
        }

        /**
         * Set an angular model validity through model.$setValidity. Changes the "model" state to manual
         * Calling this on a form has no effect.
         */
        validity(group:string, name:string, defs: IList<boolean>): angular.IPromise<IErrorMessage[]> {
            var model: IErrorModel;
            var errors: IErrorMessage[] = [];

            if (_.isEmpty(defs)) {
                throw new ErrorLookupError('Missing the definitions for ErrorLookup.validity');
            }

            if (this.repository[group] && (model = this.repository[group].models[name])) {
                if (!model.isForm) {
                    model.state.manual = true;

                    _.forEach(defs, (m, k) => {
                        model.controller.$setValidity(k, m);
                    });

                    model.helpers.error();
                }
            } else {
                throw new ErrorLookupError(`Model "${name}" not found in "${group}"`);
            }

            return this.$q.when(errors);
        }

        /**
         * Call $validate manually on the model(s) or form.
         * Calling on the form, will trigger $validate for all the children models
         */
        validate(group: string, name: string): angular.IPromise<IErrorMessage[]> {
            var g = this.repository[group];
            var errors: IErrorMessage[] = [];

            if (g) {
                var model = g.models[name];
                if (model) {
                    if (model.isForm) {
                        _.forOwn(model.children, (model, key) => {
                            if (!model.destroyed && model.controller) {
                                model.controller.$validate();
                            }
                        });
                    } else if (model.controller) {
                        model.controller.$validate();
                    }

                    model.helpers.error();
                }
            } else {
                throw new ErrorLookupError(`Group "${group}" is undefined`);
            }

            return this.$q.when(errors);
        }

        /**
         * Grab all the errors from a group.
         *
         * @example
         *
         * ErrorLookup.errors('group');
         * // {user: ErrorHelper, email: ErrorHelper, name: ErrorHelper, etc: ErrorHelper}
         *
         * ErrorLookup.errors('group', ['user','etc']);
         * // {user: ErrorHelper, etc: ErrorHelper}
         *
         * ErrorLookup.errors('group', null, true);
         * // {user: [], email: [], name: [], etc: []}
         *
         * ErrorLookup.errors('group', null, true, {required:'Overriden required error'});
         * // {user: [{message:'Overriden required error'}], email: [{message:'Overriden required error'}], name: [{message:'Overriden required error'}], etc: [{message:'Overriden required error'}]}
         */
        errors(group:string, pick: string[], errorArrays: boolean, predefine: any, helpers: boolean, reset: boolean): IList<IErrorHelper>;
        errors(group:string, pick: string[], errorArrays: boolean, predefine: any, helpers: boolean): IList<IErrorHelper>;
        errors(group:string, pick: string[], errorArrays: boolean, predefine: any): IList<IErrorGetterSetter>;
        errors(group:string, pick: string[], errorArrays: boolean): IList<IErrorMessage>;
        errors(group:string, pick: string[]): IList<IErrorMessage>;
        errors(group:string): IList<IErrorMessage>;
        errors(group:string, pick: string[] = [], errorArrays: boolean = false, predefine: any = {}, helpers: boolean = false, reset: boolean = false): any {
            var dummy: any;
            var models: string[];
            var name: any;
            var out: any;

            if (typeof this.repository[group] === 'undefined') {
                throw new ErrorLookupError(`Group "${group}" is undefined`);
            }

            models = [];

            if (!pick || pick.length === 0) {
                models = _.map(this.repository[group].models, (item, name) => name);
            } else {
                models = _.filter(pick, (model) => {
                    return typeof(this.repository[group].models[model]) !== 'undefined';
                });
            }

            out = {};

            if (models.length > 0) {
                _.forEach(models, (model) => {
                    if (errorArrays === true) {
                        out[model] = this.repository[group].models[model].errors;
                    } else {
                        if (helpers === true) {
                            out[model] = this.get(group, model, true, predefine);
                        } else {
                            out[model] = this.error(group, model, predefine);
                        }
                    }

                    if (reset) {
                        this.reset(group, model);
                    }
                });
            } else {
                throw new ErrorLookupError(`No models are defined for "${group}"`);
            }

            return out;
        }

        /**
         * Resets the state of the forced errors on the models and update the errors array
         * Can reset an entire group at once, by only providing the group name
         */
        reset(group: string, name?: string, pick: string[] = []): angular.IPromise<IErrorMessage[]> {
            var model: IErrorModel;
            var errors: IErrorMessage[] = [];

            if (typeof this.repository[group] !== 'undefined') {
                if (name) {
                    if (typeof this.repository[group].models[name] !== 'undefined') {
                        model = this.repository[group].models[name];
                        model.state.manual = false;

                        if (pick.length === 0) {
                            empty(model, 'forced');
                        } else {
                            empty(model, 'forced', (value: any, k: any) => _.contains(pick, k));
                        }
                        errors = model.helpers.error();
                    } else {
                        return this.$q.reject(new ErrorLookupError(`Model "${name}" not found in "${group}"`));
                    }
                } else {
                    _.forEach(this.repository[group].models, (value, k) => {
                        this.reset(group, k, pick);
                    });
                }
            } else {
                return this.$q.reject(new ErrorLookupError(`Group "${group}" is undefined`));
            }

            return this.$q.when(errors);
        }

        /**
         * Forcefully set an error on the model, but don't change the ngModel.$error object
         */
        set(group: string, name: string, errors : IList<Function|string|boolean>, reset: boolean = true): angular.IPromise<IErrorMessage[]> {
            var model: IErrorModel;
            var _errors: IErrorMessage[] = [];
            var g = this.repository[group];

            if (g) {
                model = g.models[name];

                if (model) {

                    if (reset) {
                        this.reset(group, name);
                    }

                    _.forEach(errors, (v, k) => {
                        model.forced[k] = v;
                        model.state.reset[k] = true;
                    });

                    model.controller.$setDirty();

                    if (model.parent && typeof model.parent.controller.$setDirty === 'function') {
                        model.parent.controller.$setDirty();
                    }

                    model.state.manual = true;
                    _errors = model.helpers.error();
                } else {
                    return this.$q.reject(new ErrorLookupError(`Model "${model}" not found in group "${group}"`));
                }
            } else {
                return this.$q.reject(new ErrorLookupError(`Group "${group}" is undefined`));
            }

            return this.$q.when(_errors);
        }

        get(group: string, name: string, helpers: boolean, predefine: any): IErrorHelper;
        get(group: string, name: string, helpers: boolean): IErrorHelper;
        get(group: string, name: string): IErrorModel;
        get(group: string): IErrorModels;
        get(group: string, name: string = '', helpers: boolean = false, predefine?: any):any {
            if (typeof this.repository[group] === 'undefined') {
                throw new ErrorLookupError(`Group "${group}" is undefined`);
            }

            if (_.isEmpty(name)) {
                return this.repository[group];
            }

            if (helpers === false) {
                return this.repository[group].models[name];
            } else {
                var self = this;
                return {
                    get item() {
                        return self.repository[group].models[name];
                    },
                    error: this.error(group, name, predefine),
                    set: function(err: any) {
                        return self.set(group, name, err);
                    },
                    label: function(item: string, name: string) {
                        self.label(group, item, name);
                        return this;
                    },
                    reset: function(pick: string[]) {
                        return self.reset(group, name, pick);
                    },
                    validity: function(validity: IList<boolean>) {
                        return self.validity(group, name, validity);
                    },
                    remove: function() {
                        return self.remove(group, name);
                    }
                };
            }
        }

        /**
         * Programatically set the label of a model or models
         *
         * @example
         *
         * ErrorLookup.set('group', 'model', 'My model');
         * ErrorLookup.set('group', {
         *   'model1': 'Model 1',
         *   'model2': 'Model 2'
         * });
         */
        label (group: string, item: Object): ErrorLookup;
        label (group: string, item: string, label: string): ErrorLookup;
        label (group: string, item: any, label: string = ''): ErrorLookup {
            if (_.isPlainObject(item)) {
                _.forEach(item, (label: string, key: string) => {
                    this.repository[group].labels[key] = label;
                });
            } else if (_.isString(item)) {
                this.repository[group].labels[item] = label;
            }

            return this;
        }

        /**
         * Manually add a model, element, scopes to the service
         */
        add(options: IErrorAddOptions): IErrorModel {
            var
                isForm: boolean,
                repoName: string,
                _model: any;

            if (!_.isPlainObject(options)) {
                throw new ErrorLookupError('ErrorLookup.add needs an object as parameter');
            }

            if (_.isEmpty(options.scope) || _.isEmpty(options.name) || _.isEmpty(options.controller)) {
                throw new ErrorLookupError('ErrorLookup.add missing non optional configurations: scope, name and controller');
            }

            repoName = options.group || options.scope.$id.toString();

            var currentRepo: IErrorModels = this.repository[repoName];

            if (!currentRepo) {
                currentRepo = this.repository[repoName] = {
                    models: {},
                    labels: {}
                };
            }

            _model = options.controller;

            isForm = !!options.isForm;

            var currentModel: IErrorModel;

            currentModel = currentRepo.models[options.name] = {
                controller: _model,
                isForm: isForm,
                scope: options.scope,
                state: {
                    manual: false,
                    reset: {}
                },
                destroyed: false,
                group: repoName,
                parent: options.parent,
                children: {},
                name: options.name,
                attrs: _.clone(options.attrs),
                element: options.el,
                errors: [],
                apply: function(fn: Function, preferEvalAsync: boolean = true): typeof currentModel {
                    var self: typeof currentModel = this;

                    if (!self.destroyed) {
                        if (preferEvalAsync) {
                            self.scope.$evalAsync((scope) => {
                                fn(scope);
                            });
                        } else {
                            self.scope.$applyAsync((scope) => {
                                fn(scope);
                            });
                        }
                    }
                    return this;
                },
                helpers: null,
                forced: {}
            };

            currentModel.helpers = this.get(repoName, options.name, true);

            if (!isForm) {
                viewChangeListener(currentModel);
            }

            if (options.label) {
                currentRepo.labels[options.name] = options.label;
            }

            return currentModel;
        }
        /**
         * Remove a model from ErrorLookup
         */
        remove(group: string, name?: string): angular.IPromise<void> {
            var g: IErrorModels;

            function removeListener(m: IErrorModel) {
                if (m && m.controller && m.controller.$viewChangeListeners) {
                    m.controller.$viewChangeListeners = _.filter(m.controller.$viewChangeListeners, (x: any) => {
                        return !x['errorLookup'];
                    });
                }
            }

            if (g = this.repository[group]) {
                if (name) {
                    if (g.labels[name]) {
                        delete g.labels[name];
                    }

                    if (g.models[name]) {
                        g.models[name].destroyed = true;

                        empty(g.models[name], 'children');

                        if (g.models[name].parent && g.models[name].parent.children && g.models[name].parent.children[name]) {
                            delete g.models[name].parent.children[name];
                        }

                        removeListener(g.models[name]);
                        empty(g.models, name);

                        delete g.models[name];
                    }
                } else {
                    _.forEach(g.models, (m) => {
                        m.destroyed = true;
                        if (m.parent && m.parent.children && m.parent.children[m.name]) {
                            delete m.parent.children[m.name];
                        }
                        removeListener(m);
                    });
                    empty(g, 'models');
                    empty(g, 'labels');

                    delete this.repository[group];
                }
            }

            return this.$q.when();
        }


        constructor(
            public $interpolate: angular.IInterpolateService,
            public $q: angular.IQService,
            $http: angular.IHttpService,
            public $timeout: angular.ITimeoutService,
            Provider: Providers.ErrorLookupProvider
        ){
            this.emptyInterpolated = $interpolate('');

            /**
             * Stores the instance messages
             */
            this.messages = {
                /**
                 * Current registered messages
                 */
                types: {},
                /**
                 * Add a message to this instance
                 */
                add: (name: string, expr: any): angular.IInterpolationFunction => {
                    if (_.isString(expr)) {
                        this.messages.types[name] = this.$interpolate(expr);
                    } else if (_.isPlainObject(expr) && expr.expr) {
                        if (_.isFunction(expr.expr)) {
                            this.messages.types[name] = expr.expr;
                        } else {
                            this.messages.types[name] = this.$interpolate(expr.expr);
                        }
                    } else if (_.isFunction(expr)) {
                        this.messages.types[name] = expr;
                    }

                    return this.messages.types[name];
                },

                /**
                 * Remove a message from this instance
                 */
                remove: (name: string): IInterpolatedMessages<IList<angular.IInterpolationFunction>> => {
                    delete this.messages.types[name];
                    return this.messages;
                },

                /**
                 * Load messages from a URL, and set them to the cache
                 */
                include: (url: string): angular.IPromise<IList<angular.IInterpolationFunction>> => {

                    return $http.get(url, {
                        cache: true
                    }).then((m) => {
                        _.forEach(m.data, (msg, key) => {
                            this.messages.add(key, msg);
                        });

                        return this.messages.types;
                    });
                }
            };

            for (var key in Provider.messageQueue) {
                this.messages.add(key, Provider.messageQueue[key]);
            }
        }

        static $inject = ['$interpolate', '$q', '$http', '$timeout'];

        static instance(
            Provider: Providers.ErrorLookupProvider,
            $interpolate: angular.IInterpolateService,
            $q: angular.IQService,
            $http: angular.IHttpService,
            $timeout: angular.ITimeoutService
        ){

            return new ErrorLookup($interpolate, $q, $http, $timeout, Provider);
        }
    }
}

export module Providers {

    export class ErrorLookupProvider {

        public messageQueue: IList<string> = {
            required: 'You must fill{{ $label ? " " + $label : " this field" }}',
            email: '{{ $value ? $value : "This" }} is not a valid email',
            pattern: 'Please provide a valid format',
            minlength: 'This minimum length allowed is {{ $attrs.minlength }}',
            maxlength: 'This maximum length allowed is {{ $attrs.maxlength }}',
            min: 'The minimum value allowed is {{ $attrs.min }}',
            max: 'The maximum value allowed is {{ $attrs.max }}'
        };

        public $get = [].concat(Services.ErrorLookup.$inject, (...args: any[]) => {
            return Services.ErrorLookup.instance.apply(null, [this].concat(args));
        });

        /**
         * Add a message to be lazy-loaded
         */
        add<T extends {}>(name: T): ErrorLookupProvider;
        add(name: string, expr: any): ErrorLookupProvider;
        add(name: any, expr?: any): ErrorLookupProvider {
            if (_.isPlainObject(name)) {
                _.forEach(name, (m, k) => {
                    this.add(k, m);
                });
            } else {
                this.messageQueue[name] = expr;
            }
            return this;
        }

        /**
         * ErrorLookupProvider options
         */
        public options:any = {};

        /**
         * Remove a message so it won't be initialized when ErrorLookup gets injected
         */
        remove(name: string): ErrorLookupProvider {
            delete this.messageQueue[name];
            return this;
        }

        static instance() {
            return [() => new this];
        }
    }


}

export interface IErrorLookupFormController {
    form?: IErrorModel;
    pending?: Function[];
    setForm?(_form: IErrorModel): void;
    appendChildren?(model: IErrorModel): void;
    defer?(fn: Function): void;
    deferreds?: Function[];
}

module Directives {

    class ErrorLookupForm implements angular.IDirective {
        restrict = 'A';
        require = ['form', 'errorLookupForm'];
        link: angular.IDirectivePrePost;
        controller: IErrorLookupFormController;
        priority = -100;

        constructor(ErrorLookup: Services.ErrorLookup) {

            this.controller = function() {
                this.form = null;
                this.pending = [];
                this.deferreds = [];

                this.setForm = (_form: IErrorModel) => {
                    this.form = _form;

                    var fn: Function;

                    if (!_form.destroyed) {
                        while (fn = this.pending.shift()) {
                            fn();
                        }
                        while (fn = this.deferreds.shift()) {
                            fn();
                        }
                    }
                };

                this.defer = (fn: Function) => {
                    if (!this.form) {
                        this.deferreds.push(fn);
                    } else {
                        fn();
                    }
                };

                this.appendChildren = (model: IErrorModel) => {
                    var add = () => {
                        model.parent = this.form;
                        this.form.children[model.name] = model;
                    };

                    if (!this.form) {
                        this.pending.push(() => {
                            if (model && this.form && !model.destroyed && !this.form.destroyed) {
                                add();
                            }
                        });
                    } else {
                        add();
                    }
                };

            };

            this.link = {
                post:  (
                    scope: angular.IScope,
                    el: angular.IAugmentedJQuery,
                    attrs: angular.IAttributes,
                    ctrls: any[]
                    ) => {
                    var error: IErrorModel;
                    var group: string;
                    var label: string;
                    var name: string;

                    group = !_.isEmpty(attrs['errorLookupForm']) ? attrs['errorLookupForm'] : scope.$id;
                    label = _.isString(attrs['errorLookupLabel']) && !_.isEmpty(attrs['errorLookupLabel']) ? attrs['errorLookupLabel'] : void 0;
                    name = !_.isEmpty(attrs['errorLookupName']) ? attrs['errorLookupName'] : el.attr('name');

                    error = ErrorLookup.add({
                        scope: scope,
                        el: el,
                        name: name,
                        controller: ctrls[0],
                        attrs: attrs,
                        group: group,
                        label: label,
                        isForm: true
                    });

                    var ctrl: IErrorLookupFormController = ctrls[1];

                    ctrl.setForm(error);

                    scope.$on('$destroy', () => {
                        ctrl.form = null;
                        ctrl.pending = [];
                        ctrl.deferreds = [];

                        if (!error.destroyed) {
                            error.helpers.remove();
                        }
                    });
                }
            };

        }

        static instance() {
            return [
                'ErrorLookup',
                (
                    EL: any
                ) => new this(
                    EL
                )
            ];
        }
    }

    export var errorLookupForm: angular.IDirective = ErrorLookupForm.instance();

    class ErrorLookup implements angular.IDirective {
        restrict = 'A';
        require = ['ngModel', '?^errorLookupForm'];
        link: angular.IDirectivePrePost;
        priority = 90;

        constructor(ErrorLookup: Services.ErrorLookup) {

            this.link = {
                post:  (scope: angular.IScope, el: angular.IAugmentedJQuery, attrs: angular.IAttributes, ctrls: any[]) => {
                    var error: IErrorModel;
                    var group: string;
                    var label: string;
                    var name: string;

                    group = attrs['errorLookup'] ? attrs['errorLookup'] : scope.$id;
                    label = _.isString(attrs['errorLookupLabel']) && !_.isEmpty(attrs['errorLookupLabel']) ? attrs['errorLookupLabel'] : void 0;
                    name = el.attr('name') || attrs['ngModel'];

                    if (_.isString(attrs['errorLookupName']) && !_.isEmpty(attrs['errorLookupName'])) {
                        name = attrs['errorLookupName'];
                    } else if (!_.isEmpty(ctrls[0].$name)) {
                        name = ctrls[0].$name;
                    }

                    error = ErrorLookup.add({
                        scope: scope,
                        el: el,
                        name: name,
                        controller: ctrls[0],
                        attrs: attrs,
                        group: group,
                        label: label,
                        isForm: false
                    });

                    var parent: IErrorLookupFormController = ctrls[1];

                    if (parent) {
                        parent.appendChildren(error);
                    }

                    scope.$on('$destroy', () => {
                        if (!error.destroyed) {
                            error.helpers.remove();
                        }
                    });
                }
            };

        }

        static instance(){
            return [
                'ErrorLookup',
                (
                    ErrorLookup: any
                ) => new this(
                    ErrorLookup
                )
            ];
        }
    }

    export var errorLookup: angular.IDirective = ErrorLookup.instance();

    class ErrorLookupDisplay implements angular.IDirective {

        restrict = 'A';
        require = '?^errorLookupForm';
        scope = true;
        link: angular.IDirectivePrePost;
        priority = 100;
        controller = ['$scope', function($scope: IErrorScope){

            this.setOptions = (options: IErrorFilterOptions) => {

                if (_.isObject(options)) {
                    $scope.$options = options;
                }

            };

        }]

        constructor(ErrorLookup: Services.ErrorLookup) {

            this.link = {
                pre: (scope: IErrorScope) => {
                    scope.$latestHtml = void 0;
                    scope.$firstHtml = void 0;
                    scope.$first = void 0;
                    scope.$options = {};
                    scope.$latest = void 0;
                    scope.$errors = [];
                    scope.$errorCount = 0;
                },
                post:  (scope: IErrorScope, el: angular.IAugmentedJQuery, attr: angular.IAttributes, ctrl: IErrorLookupFormController) => {

                    function init() {
                        var group: string;
                        var model: IErrorHelper;

                        group = attr['errorLookupGroup'] ? attr['errorLookupGroup'] : scope.$parent.$id;

                        model = ErrorLookup.get(group, attr['errorLookupDisplay'], true);

                        if (!model || !model.item) {
                            throw new ErrorLookupError(`Could not find model for "${group}"`);
                        }

                        scope.$model = model;

                        var error = model.error;

                        scope.$errorCount = model.item.errors.length;
                        scope.$errors = model.item.errors;

                        if (_.isEmpty(attr['errorLookupShow'])) {
                            scope.$displaying = () => {
                                return model && model.item && model.item.errors && model.item.errors.length && (
                                    (model.item.controller.$touched && model.item.controller.$dirty) || model.item.state.manual === true
                                );
                            };
                        } else {
                            scope.$displaying = () => {
                                var ret = scope.$parent.$eval(attr['errorLookupShow'], {
                                    $model: model.item.controller,
                                    $error: model.error,
                                    $errors: model.item.errors,
                                    $attrs: attr,
                                    $value: model.item.controller.$viewValue,
                                    $name: model.item.name,
                                    $scope: scope
                                });
                                return ret;
                            };
                        }

                        var unwatch = scope.$parent.$watchCollection(
                            () => {
                                return _.map(error(), (i) => i.message);
                            },
                            (e, o):void => {
                                scope.$errorCount = e.length;
                                if (scope.$errorCount && scope.$errors) {
                                    scope.$latest = scope.$errors[scope.$errorCount - 1];
                                    scope.$first = scope.$errors[0];
                                } else {
                                    scope.$latest = void 0;
                                    scope.$first = void 0;
                                }
                            }
                        );

                        scope.$on('$destroy', () => {
                            unwatch();
                            scope.$model = null;
                            scope.$errors = null;
                            scope.$displaying = null;
                            error = null;
                        });
                    }

                    if (ctrl) {
                        ctrl.defer(init);
                    } else {
                        init();
                    }
                }
            };
        }

        static instance() {
            return [
                'ErrorLookup',
                (
                    ErrorLookup: any
                ) => new this(
                    ErrorLookup
                )
            ];
        }
    }

    export var errorLookupDisplay: angular.IDirective = ErrorLookupDisplay.instance();

    class ErrorLookupTemplate implements angular.IDirective {
        restrict = 'A';
        require = 'errorLookupDisplay';
        template = `<ul class="error-lookup-display" ng-show="$displaying()">
                        <li class="error-lookup-display-item" ng-repeat="error in $errors | errorMessages:$options track by $index" ng-bind-html="error"></li>
                    </ul>`;
        link: angular.IDirectiveLinkFn;

        constructor() {

            this.link = (scope: IErrorScope, el: angular.IAugmentedJQuery, attrs: angular.IAttributes, ctrl: any) => {
                ctrl.setOptions(scope.$eval(attrs['errorLookupTemplate']));
            };

        }

        static instance() {
            return [() => new this()];
        }
    }

    export var errorLookupTemplate: angular.IDirective = ErrorLookupTemplate.instance();
}

module Filters {

    class ErrorMessages {
        static filter(item:IErrorMessage[], options?: IErrorFilterOptions): string[];
        static filter(item:IErrorMessage, options?: IErrorFilterOptions): string;
        static filter(item: any, options: IErrorFilterOptions = {}): any {
            var limit: number = options.limit || 1;

            var filterFn: IFilterFunction = (type) => {
                var ret: boolean = true;

                if (options.filter) {
                    if (_.isFunction(options.filter)) {
                        var fn: IFilterFn = <IFilterFn>options.filter;
                        ret = ret && fn(type);
                    } else if (_.isArray(options.filter)) {
                        var ln: string[] = <string[]>options.filter;
                        ret = ret && _.some(ln, (i) => {
                            return (i === type);
                        });
                    } else if (_.isString(options.filter)) {
                        ret = ret && (options.filter === type);
                    }
                }

                if (options.exclude) {
                    if (_.isFunction(options.exclude)) {
                        var fn: IFilterFn = <IFilterFn>options.exclude;
                        ret = ret && !fn(type);
                    } else if (_.isArray(options.exclude)) {
                        var ln: string[] = <string[]>options.exclude;
                        ret = ret && _.every(ln, (i) => {
                            return (i !== type);
                        });
                    } else if (_.isString(options.exclude)) {
                        ret = ret && (options.exclude !== type);
                    }
                }

                return ret;
            };

            if (item && item.length) {
                return _<IErrorMessage>(item).filter((i) => {
                    return i && i.message && filterFn(i.type) && limit-- > 0;
                }).map((i) => i.message).valueOf();
            } else if (item && item.message) {
                if (item.type) {
                    if (filterFn(item.type)) {
                        return item.message;
                    }
                } else if (item.message) {
                    return item.message;
                } else {
                    if (angular.isArray(item)) {
                        return item;
                    }
                }
            } else {
                if (angular.isArray(item)) {
                    return item;
                }
            }
            return;
        }

        static instance() {
            return [() => this.filter];
        }
    }

    export var errorMessages: any = ErrorMessages.instance();

}

angular
.module('ngErrorLookup', [])
.provider('ErrorLookup', Providers.ErrorLookupProvider.instance())
.directive(Directives)
.filter(Filters)
;
