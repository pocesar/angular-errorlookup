(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports", 'angular', 'lodash'], factory);
    }
})(function (require, exports) {
    'use strict';
    var angular = require('angular');
    var _ = require('lodash');
    var ErrorLookupError = (function () {
        function ErrorLookupError(message) {
            var error = Error.call(this, message);
            this.name = 'ErrorLookupError';
            this.message = error.message;
            this.stack = error.stack;
        }
        return ErrorLookupError;
    }());
    exports.ErrorLookupError = ErrorLookupError;
    ErrorLookupError.prototype = Object.create(Error.prototype, {
        constructor: {
            value: ErrorLookupError,
            writable: true,
            configurable: true
        }
    });
    function viewChangeListener(model) {
        var skip, controller;
        if (!controller || !controller.$viewChangeListeners) {
            return;
        }
        controller = model.controller;
        skip = false;
        _.forEach(controller.$viewChangeListeners, function (vcl) {
            if (vcl['errorLookup'] === true) {
                skip = true;
            }
        });
        if (!skip) {
            var v = function () {
                _.forEach(model.state.reset, function (reset, field) {
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
    function empty(obj, member, filter, del) {
        if (del === void 0) { del = false; }
        if (obj) {
            if (del === true) {
                delete obj[member];
            }
            else {
                if (_.isArray(obj[member])) {
                    obj[member].length = 0;
                }
                else if (_.isPlainObject(obj[member])) {
                    _.forIn(obj[member], function (v, k) {
                        if (filter && filter(v, k)) {
                            delete obj[member][k];
                        }
                        else {
                            delete obj[member][k];
                        }
                    });
                }
            }
        }
    }
    var Services;
    (function (Services) {
        var ErrorLookup = (function () {
            function ErrorLookup($interpolate, $q, $http, $timeout, Provider) {
                var _this = this;
                this.$interpolate = $interpolate;
                this.$q = $q;
                this.$timeout = $timeout;
                this.repository = {};
                this.incrementalId = 0;
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
                    add: function (name, expr) {
                        if (_.isString(expr)) {
                            _this.messages.types[name] = _this.$interpolate(expr);
                        }
                        else if (_.isPlainObject(expr) && expr.expr) {
                            if (_.isFunction(expr.expr)) {
                                _this.messages.types[name] = expr.expr;
                            }
                            else {
                                _this.messages.types[name] = _this.$interpolate(expr.expr);
                            }
                        }
                        else if (_.isFunction(expr)) {
                            _this.messages.types[name] = expr;
                        }
                        return _this.messages.types[name];
                    },
                    /**
                     * Remove a message from this instance
                     */
                    remove: function (name) {
                        delete _this.messages.types[name];
                        return _this.messages;
                    },
                    /**
                     * Load messages from a URL, and set them to the cache
                     */
                    include: function (url) {
                        return $http.get(url, {
                            cache: true
                        }).then(function (m) {
                            _.forEach(m.data, function (msg, key) {
                                _this.messages.add(key, msg);
                            });
                            return _this.messages.types;
                        });
                    }
                };
                for (var key in Provider.messageQueue) {
                    this.messages.add(key, Provider.messageQueue[key]);
                }
            }
            ErrorLookup.prototype.translate = function (message) {
                var _this = this;
                if (_.isString(message)) {
                    if (typeof this.messages[message] === 'function') {
                        return this.messages[message];
                    }
                    else {
                        throw new ErrorLookupError("Message " + message + " is not defined");
                    }
                }
                else if (_.isPlainObject(message)) {
                    var out = {};
                    _.forIn(message, function (str, key) {
                        out[key] = _this.translate(key);
                    });
                    return out;
                }
                return this.emptyInterpolated;
            };
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
            ErrorLookup.prototype.error = function (group, name, predefine, bypass) {
                var _this = this;
                if (bypass === void 0) { bypass = false; }
                var customMessages, model, repo;
                repo = this.repository[group];
                if (!repo) {
                    return function () { return []; };
                }
                model = repo.models[name];
                if (!model) {
                    return function () { return []; };
                }
                var fromModel = function (model, key) {
                    if (key) {
                        var ngModel = model;
                        if (ngModel) {
                            if (ngModel.controller && typeof ngModel.controller[key] !== 'undefined') {
                                return ngModel.controller[key];
                            }
                            if (typeof ngModel[key] !== 'undefined') {
                                return ngModel[key];
                            }
                        }
                    }
                    else if (model) {
                        if (model.controller) {
                            return model.controller;
                        }
                        else {
                            return model;
                        }
                    }
                    return '';
                };
                var findName = function (e, retName) {
                    if (retName === void 0) { retName = true; }
                    if (e) {
                        var n;
                        if ((n = fromModel(e, '$name'))) {
                            if (repo.labels[n]) {
                                return repo.labels[n];
                            }
                            return n;
                        }
                        else if (repo.labels[name]) {
                            return repo.labels[name];
                        }
                        return _.reduce(repo.models, function (current, model) {
                            if (model === e) {
                                if (repo.labels[name]) {
                                    return repo.labels[name];
                                }
                                else {
                                    return name;
                                }
                            }
                        }, '');
                    }
                    if (retName) {
                        return name;
                    }
                    else {
                        return '';
                    }
                };
                customMessages = !_.isEmpty(predefine) && _.isPlainObject(predefine);
                var modelByDefinition = function (model) {
                    return _.find(repo.models, function (m) {
                        return m.controller === model;
                    });
                };
                var predefined = function (key, model) {
                    var m;
                    if (customMessages && predefine[key]) {
                        if (_.isString(predefine[key])) {
                            return _this.$interpolate(predefine[key]);
                        }
                        else if (_.isFunction(predefine[key])) {
                            return predefine[key];
                        }
                    }
                    if (model && (m = fromModel(model, '$error'))) {
                        if (m[key] === false) {
                            return false;
                        }
                    }
                    if (_.isFunction(_this.messages.types[key])) {
                        return _this.messages.types[key];
                    }
                    return false;
                };
                var common = function (key, error) {
                    var fn, label, obj;
                    if (typeof key === 'undefined' || typeof error === 'undefined') {
                        return;
                    }
                    if (error === true) {
                        fn = predefined(key);
                    }
                    else if (_.isString(error)) {
                        fn = _this.$interpolate(error);
                    }
                    if (fn) {
                        label = findName(model);
                        obj = {
                            id: _this.incrementalId++,
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
                return function (extra) {
                    if (!model || model.destroyed || !model.controller) {
                        if (_.isArray(model.errors)) {
                            return model.errors;
                        }
                        else {
                            return [];
                        }
                    }
                    if (extra === true) {
                        return model.errors;
                    }
                    model.errors.length = 0;
                    var errs;
                    errs = {};
                    if (!_.isEmpty(model.controller) && _.isPlainObject(model.controller.$error)) {
                        _.extend(errs, model.controller.$error);
                    }
                    if (_.isPlainObject(extra)) {
                        _.extend(errs, extra);
                    }
                    _.forEach(errs, function (error, key) {
                        var fn = false;
                        if (model.isForm) {
                            var frm = findName(model);
                            var already = [];
                            _.forEach(error, function (e) {
                                var obj, label;
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
                                        id: _this.incrementalId++,
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
                        }
                        else {
                            common(key, error);
                        }
                    });
                    _.forEach(model.forced, function (error, key) {
                        common(key, error);
                    });
                    return model.errors;
                };
            };
            /**
             * Set an angular model validity through model.$setValidity. Changes the "model" state to manual
             * Calling this on a form has no effect.
             */
            ErrorLookup.prototype.validity = function (group, name, defs) {
                var model;
                var errors = [];
                if (_.isEmpty(defs)) {
                    throw new ErrorLookupError('Missing the definitions for ErrorLookup.validity');
                }
                if (this.repository[group] && (model = this.repository[group].models[name])) {
                    if (!model.isForm) {
                        model.state.manual = true;
                        _.forEach(defs, function (m, k) {
                            model.controller.$setValidity(k, m);
                        });
                        model.helpers.error();
                    }
                }
                else {
                    throw new ErrorLookupError("Model \"" + name + "\" not found in \"" + group + "\"");
                }
                return this.$q.when(errors);
            };
            /**
             * Call $validate manually on the model(s) or form.
             * Calling on the form, will trigger $validate for all the children models
             */
            ErrorLookup.prototype.validate = function (group, name) {
                var g = this.repository[group];
                var errors = [];
                if (g) {
                    var model = g.models[name];
                    if (model) {
                        if (model.isForm) {
                            _.forOwn(model.children, function (model, key) {
                                if (!model.destroyed && model.controller) {
                                    model.controller.$validate();
                                }
                            });
                        }
                        else if (model.controller) {
                            model.controller.$validate();
                        }
                        model.helpers.error();
                    }
                }
                else {
                    throw new ErrorLookupError("Group \"" + group + "\" is undefined");
                }
                return this.$q.when(errors);
            };
            ErrorLookup.prototype.errors = function (group, pick, errorArrays, predefine, helpers, reset) {
                var _this = this;
                if (pick === void 0) { pick = []; }
                if (errorArrays === void 0) { errorArrays = false; }
                if (predefine === void 0) { predefine = {}; }
                if (helpers === void 0) { helpers = false; }
                if (reset === void 0) { reset = false; }
                var dummy;
                var models;
                var name;
                var out;
                if (typeof this.repository[group] === 'undefined') {
                    throw new ErrorLookupError("Group \"" + group + "\" is undefined");
                }
                models = [];
                if (!pick || pick.length === 0) {
                    models = _.map(this.repository[group].models, function (item, name) { return name; });
                }
                else {
                    models = _.filter(pick, function (model) {
                        return typeof (_this.repository[group].models[model]) !== 'undefined';
                    });
                }
                out = {};
                if (models.length > 0) {
                    _.forEach(models, function (model) {
                        if (errorArrays === true) {
                            out[model] = _this.repository[group].models[model].errors;
                        }
                        else {
                            if (helpers === true) {
                                out[model] = _this.get(group, model, true, predefine);
                            }
                            else {
                                out[model] = _this.error(group, model, predefine);
                            }
                        }
                        if (reset) {
                            _this.reset(group, model);
                        }
                    });
                }
                else {
                    throw new ErrorLookupError("No models are defined for \"" + group + "\"");
                }
                return out;
            };
            /**
             * Resets the state of the forced errors on the models and update the errors array
             * Can reset an entire group at once, by only providing the group name
             */
            ErrorLookup.prototype.reset = function (group, name, pick) {
                var _this = this;
                if (pick === void 0) { pick = []; }
                var model;
                var errors = [];
                if (typeof this.repository[group] !== 'undefined') {
                    if (name) {
                        if (typeof this.repository[group].models[name] !== 'undefined') {
                            model = this.repository[group].models[name];
                            model.state.manual = false;
                            if (pick.length === 0) {
                                empty(model, 'forced');
                            }
                            else {
                                empty(model, 'forced', function (value, k) { return _.includes(pick, k); });
                            }
                            errors = model.helpers.error();
                        }
                        else {
                            return this.$q.reject(new ErrorLookupError("Model \"" + name + "\" not found in \"" + group + "\""));
                        }
                    }
                    else {
                        _.forEach(this.repository[group].models, function (value, k) {
                            _this.reset(group, k, pick);
                        });
                    }
                }
                else {
                    return this.$q.reject(new ErrorLookupError("Group \"" + group + "\" is undefined"));
                }
                return this.$q.when(errors);
            };
            ErrorLookup.prototype.set = function (group, name, errors, reset) {
                if (errors === void 0) { errors = {}; }
                if (reset === void 0) { reset = true; }
                var model;
                var _errors = [];
                var g = this.repository[group];
                if (g) {
                    model = g.models[name];
                    if (model) {
                        if (reset) {
                            this.reset(group, name);
                        }
                        _.forIn(errors, function (v, k) {
                            model.forced[k] = v;
                            model.state.reset[k] = true;
                        });
                        model.controller.$setDirty();
                        if (model.parent && typeof model.parent.controller.$setDirty === 'function') {
                            model.parent.controller.$setDirty();
                        }
                        model.state.manual = true;
                        _errors = model.helpers.error();
                    }
                    else {
                        return this.$q.reject(new ErrorLookupError("Model \"" + model + "\" not found in group \"" + group + "\""));
                    }
                }
                else {
                    return this.$q.reject(new ErrorLookupError("Group \"" + group + "\" is undefined"));
                }
                return this.$q.when(_errors);
            };
            ErrorLookup.prototype.get = function (group, name, helpers, predefine) {
                if (name === void 0) { name = ''; }
                if (helpers === void 0) { helpers = false; }
                if (typeof this.repository[group] === 'undefined') {
                    throw new ErrorLookupError("Group \"" + group + "\" is undefined");
                }
                if (_.isEmpty(name)) {
                    return this.repository[group];
                }
                if (helpers === false) {
                    return this.repository[group].models[name];
                }
                else {
                    var self = this;
                    return {
                        get item() {
                            return self.repository[group].models[name];
                        },
                        error: this.error(group, name, predefine),
                        set: function (err) {
                            return self.set(group, name, err);
                        },
                        label: function (item, name) {
                            self.label(group, item, name);
                            return this;
                        },
                        reset: function (pick) {
                            return self.reset(group, name, pick);
                        },
                        validity: function (validity) {
                            if (validity === void 0) { validity = {}; }
                            return self.validity(group, name, validity);
                        },
                        remove: function () {
                            return self.remove(group, name);
                        }
                    };
                }
            };
            ErrorLookup.prototype.label = function (group, item, label) {
                var _this = this;
                if (label === void 0) { label = ''; }
                if (_.isPlainObject(item)) {
                    _.forIn(item, function (label, key) {
                        _this.repository[group].labels[key] = label;
                    });
                }
                else if (_.isString(item)) {
                    this.repository[group].labels[item] = label;
                }
                return this;
            };
            /**
             * Manually add a model, element, scopes to the service
             */
            ErrorLookup.prototype.add = function (options) {
                var isForm, repoName, _model;
                if (!_.isPlainObject(options)) {
                    throw new ErrorLookupError('ErrorLookup.add needs an object as parameter');
                }
                if (_.isEmpty(options.scope) || _.isEmpty(options.name) || _.isEmpty(options.controller)) {
                    throw new ErrorLookupError('ErrorLookup.add missing non optional configurations: scope, name and controller');
                }
                repoName = options.group || options.scope.$id.toString();
                var currentRepo = this.repository[repoName];
                if (!currentRepo) {
                    currentRepo = this.repository[repoName] = {
                        models: {},
                        labels: {}
                    };
                }
                _model = options.controller;
                isForm = !!options.isForm;
                var currentModel;
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
                    apply: function (fn, preferEvalAsync) {
                        if (preferEvalAsync === void 0) { preferEvalAsync = true; }
                        var self = this;
                        if (!self.destroyed) {
                            if (preferEvalAsync) {
                                self.scope.$evalAsync(function (scope) {
                                    fn(scope);
                                });
                            }
                            else {
                                self.scope.$applyAsync(function (scope) {
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
            };
            /**
             * Remove a model from ErrorLookup
             */
            ErrorLookup.prototype.remove = function (group, name) {
                var g;
                function removeListener(m) {
                    if (m && m.controller && m.controller.$viewChangeListeners) {
                        m.controller.$viewChangeListeners = _.filter(m.controller.$viewChangeListeners, function (x) {
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
                    }
                    else {
                        _.forEach(g.models, function (m) {
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
            };
            ErrorLookup.instance = function (Provider, $interpolate, $q, $http, $timeout) {
                return new ErrorLookup($interpolate, $q, $http, $timeout, Provider);
            };
            ErrorLookup.$inject = ['$interpolate', '$q', '$http', '$timeout'];
            return ErrorLookup;
        }());
        Services.ErrorLookup = ErrorLookup;
    })(Services = exports.Services || (exports.Services = {}));
    var Providers;
    (function (Providers) {
        var ErrorLookupProvider = (function () {
            function ErrorLookupProvider() {
                var _this = this;
                this.messageQueue = {
                    required: 'You must fill{{ $label ? " " + $label : " this field" }}',
                    email: '{{ $value ? $value : "This" }} is not a valid email',
                    pattern: 'Please provide a valid format',
                    minlength: 'This minimum length allowed is {{ $attrs.minlength }}',
                    maxlength: 'This maximum length allowed is {{ $attrs.maxlength }}',
                    min: 'The minimum value allowed is {{ $attrs.min }}',
                    max: 'The maximum value allowed is {{ $attrs.max }}'
                };
                this.$get = [].concat(Services.ErrorLookup.$inject, function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i - 0] = arguments[_i];
                    }
                    return Services.ErrorLookup.instance.apply(null, [_this].concat(args));
                });
                /**
                 * ErrorLookupProvider options
                 */
                this.options = {};
            }
            ErrorLookupProvider.prototype.add = function (name, expr) {
                var _this = this;
                if (_.isPlainObject(name)) {
                    _.forEach(name, function (m, k) {
                        _this.add(k, m);
                    });
                }
                else {
                    this.messageQueue[name] = expr;
                }
                return this;
            };
            /**
             * Remove a message so it won't be initialized when ErrorLookup gets injected
             */
            ErrorLookupProvider.prototype.remove = function (name) {
                delete this.messageQueue[name];
                return this;
            };
            ErrorLookupProvider.instance = function () {
                var _this = this;
                return [function () { return new _this; }];
            };
            return ErrorLookupProvider;
        }());
        Providers.ErrorLookupProvider = ErrorLookupProvider;
    })(Providers = exports.Providers || (exports.Providers = {}));
    var Directives;
    (function (Directives) {
        var ErrorLookupForm = (function () {
            function ErrorLookupForm(ErrorLookup) {
                this.restrict = 'A';
                this.require = ['form', 'errorLookupForm'];
                this.priority = -100;
                this.controller = function () {
                    var _this = this;
                    this.form = null;
                    this.pending = [];
                    this.deferreds = [];
                    this.setForm = function (_form) {
                        _this.form = _form;
                        var fn;
                        if (!_form.destroyed) {
                            while (fn = _this.pending.shift()) {
                                fn();
                            }
                            while (fn = _this.deferreds.shift()) {
                                fn();
                            }
                        }
                    };
                    this.defer = function (fn) {
                        if (!_this.form) {
                            _this.deferreds.push(fn);
                        }
                        else {
                            fn();
                        }
                    };
                    this.appendChildren = function (model) {
                        var add = function () {
                            model.parent = _this.form;
                            _this.form.children[model.name] = model;
                        };
                        if (!_this.form) {
                            _this.pending.push(function () {
                                if (model && _this.form && !model.destroyed && !_this.form.destroyed) {
                                    add();
                                }
                            });
                        }
                        else {
                            add();
                        }
                    };
                };
                this.link = {
                    post: function (scope, el, attrs, ctrls) {
                        var error;
                        var group;
                        var label;
                        var name;
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
                        var ctrl = ctrls[1];
                        ctrl.setForm(error);
                        scope.$on('$destroy', function () {
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
            ErrorLookupForm.instance = function () {
                var _this = this;
                return [
                    'ErrorLookup',
                    function (EL) {
                        return new _this(EL);
                    }
                ];
            };
            return ErrorLookupForm;
        }());
        Directives.errorLookupForm = ErrorLookupForm.instance();
        var ErrorLookup = (function () {
            function ErrorLookup(ErrorLookup) {
                this.restrict = 'A';
                this.require = ['ngModel', '?^errorLookupForm'];
                this.priority = 90;
                this.link = {
                    post: function (scope, el, attrs, ctrls) {
                        var error;
                        var group;
                        var label;
                        var name;
                        group = attrs['errorLookup'] ? attrs['errorLookup'] : scope.$id;
                        label = _.isString(attrs['errorLookupLabel']) && !_.isEmpty(attrs['errorLookupLabel']) ? attrs['errorLookupLabel'] : void 0;
                        name = el.attr('name') || attrs['ngModel'];
                        if (_.isString(attrs['errorLookupName']) && !_.isEmpty(attrs['errorLookupName'])) {
                            name = attrs['errorLookupName'];
                        }
                        else if (!_.isEmpty(ctrls[0].$name)) {
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
                        var parent = ctrls[1];
                        if (parent) {
                            parent.appendChildren(error);
                        }
                        scope.$on('$destroy', function () {
                            if (!error.destroyed) {
                                error.helpers.remove();
                            }
                        });
                    }
                };
            }
            ErrorLookup.instance = function () {
                var _this = this;
                return [
                    'ErrorLookup',
                    function (ErrorLookup) {
                        return new _this(ErrorLookup);
                    }
                ];
            };
            return ErrorLookup;
        }());
        Directives.errorLookup = ErrorLookup.instance();
        var ErrorLookupDisplay = (function () {
            function ErrorLookupDisplay(ErrorLookup) {
                this.restrict = 'A';
                this.require = '?^errorLookupForm';
                this.scope = true;
                this.priority = 100;
                this.controller = ['$scope', function ($scope) {
                        this.setOptions = function (options) {
                            if (_.isObject(options)) {
                                $scope.$options = options;
                            }
                        };
                    }];
                this.link = {
                    pre: function (scope) {
                        scope.$latestHtml = void 0;
                        scope.$firstHtml = void 0;
                        scope.$first = void 0;
                        scope.$options = {};
                        scope.$latest = void 0;
                        scope.$errors = [];
                        scope.$errorCount = 0;
                    },
                    post: function (scope, el, attr, ctrl) {
                        function init() {
                            var group;
                            var model;
                            group = attr['errorLookupGroup'] ? attr['errorLookupGroup'] : scope.$parent.$id;
                            model = ErrorLookup.get(group, attr['errorLookupDisplay'], true);
                            if (!model || !model.item) {
                                throw new ErrorLookupError("Could not find model for \"" + group + "\"");
                            }
                            scope.$model = model;
                            var error = model.error;
                            scope.$errorCount = model.item.errors.length;
                            scope.$errors = model.item.errors;
                            if (_.isEmpty(attr['errorLookupShow'])) {
                                scope.$displaying = function () {
                                    return model && model.item && model.item.errors && model.item.errors.length && ((model.item.controller.$touched && model.item.controller.$dirty) || model.item.state.manual === true);
                                };
                            }
                            else {
                                scope.$displaying = function () {
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
                            var unwatch = scope.$parent.$watchCollection(function () {
                                return _.map(error(), function (i) { return i.message; });
                            }, function (e, o) {
                                scope.$errorCount = e.length;
                                if (scope.$errorCount && scope.$errors) {
                                    scope.$latest = scope.$errors[scope.$errorCount - 1];
                                    scope.$first = scope.$errors[0];
                                }
                                else {
                                    scope.$latest = void 0;
                                    scope.$first = void 0;
                                }
                            });
                            scope.$on('$destroy', function () {
                                unwatch();
                                scope.$model = null;
                                scope.$errors = null;
                                scope.$displaying = null;
                                error = null;
                            });
                        }
                        if (ctrl) {
                            ctrl.defer(init);
                        }
                        else {
                            init();
                        }
                    }
                };
            }
            ErrorLookupDisplay.instance = function () {
                var _this = this;
                return [
                    'ErrorLookup',
                    function (ErrorLookup) {
                        return new _this(ErrorLookup);
                    }
                ];
            };
            return ErrorLookupDisplay;
        }());
        Directives.errorLookupDisplay = ErrorLookupDisplay.instance();
        var ErrorLookupTemplate = (function () {
            function ErrorLookupTemplate() {
                this.restrict = 'A';
                this.require = 'errorLookupDisplay';
                this.template = "<ul class=\"error-lookup-display\" ng-show=\"$displaying()\">\n\t\t\t\t\t\t\t\t\t\t\t\t<li class=\"error-lookup-display-item\" ng-repeat=\"error in $errors | errorMessages:$options track by $index\" ng-bind-html=\"error\"></li>\n\t\t\t\t\t\t\t\t\t\t</ul>";
                this.link = function (scope, el, attrs, ctrl) {
                    ctrl.setOptions(scope.$eval(attrs['errorLookupTemplate']));
                };
            }
            ErrorLookupTemplate.instance = function () {
                var _this = this;
                return [function () { return new _this(); }];
            };
            return ErrorLookupTemplate;
        }());
        Directives.errorLookupTemplate = ErrorLookupTemplate.instance();
    })(Directives || (Directives = {}));
    var Filters;
    (function (Filters) {
        var ErrorMessages = (function () {
            function ErrorMessages() {
            }
            ErrorMessages.filter = function (item, options) {
                if (options === void 0) { options = {}; }
                var limit = options.limit || 1;
                var filterFn = function (type) {
                    var ret = true;
                    if (options.filter) {
                        if (_.isFunction(options.filter)) {
                            var fn = options.filter;
                            ret = ret && fn(type);
                        }
                        else if (_.isArray(options.filter)) {
                            var ln = options.filter;
                            ret = ret && _.some(ln, function (i) {
                                return (i === type);
                            });
                        }
                        else if (_.isString(options.filter)) {
                            ret = ret && (options.filter === type);
                        }
                    }
                    if (options.exclude) {
                        if (_.isFunction(options.exclude)) {
                            var fn = options.exclude;
                            ret = ret && !fn(type);
                        }
                        else if (_.isArray(options.exclude)) {
                            var ln = options.exclude;
                            ret = ret && _.every(ln, function (i) {
                                return (i !== type);
                            });
                        }
                        else if (_.isString(options.exclude)) {
                            ret = ret && (options.exclude !== type);
                        }
                    }
                    return ret;
                };
                if (item && item.length) {
                    return _(item).filter(function (i) {
                        return i && i.message && filterFn(i.type) && limit-- > 0;
                    }).map(function (i) { return i.message; }).value();
                }
                else if (item && item.message) {
                    if (item.type) {
                        if (filterFn(item.type)) {
                            return item.message;
                        }
                    }
                    else if (item.message) {
                        return item.message;
                    }
                    else {
                        if (angular.isArray(item)) {
                            return item;
                        }
                    }
                }
                else {
                    if (angular.isArray(item)) {
                        return item;
                    }
                }
                return;
            };
            ErrorMessages.instance = function () {
                var _this = this;
                return [function () { return _this.filter; }];
            };
            return ErrorMessages;
        }());
        Filters.errorMessages = ErrorMessages.instance();
    })(Filters || (Filters = {}));
    angular
        .module('ngErrorLookup', [])
        .provider('ErrorLookup', Providers.ErrorLookupProvider.instance())
        .directive(Directives)
        .filter(Filters);
});
