import * as angular from 'angular';
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
    exclude?: string[] | IFilterFn | string;
    filter?: string[] | IFilterFn | string;
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
    set(err: any): angular.IPromise<IErrorMessage[]>;
    label(item: string, name: string): IErrorHelper;
    reset(pick?: any): angular.IPromise<IErrorMessage[]>;
    validity(validity?: any): angular.IPromise<IErrorMessage[]>;
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
    forced: IList<Function | boolean | string>;
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
export declare class ErrorLookupError implements Error {
    name: string;
    message: string;
    stack: any;
    constructor(message: string);
}
export declare namespace Services {
    class ErrorLookup {
        $interpolate: angular.IInterpolateService;
        $q: angular.IQService;
        $timeout: angular.ITimeoutService;
        repository: IList<IErrorModels>;
        messages: IInterpolatedMessages<IList<angular.IInterpolationFunction>>;
        emptyInterpolated: angular.IInterpolationFunction;
        private incrementalId;
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
        error(group: string, name: string, predefine: any, bypass?: any): IErrorGetterSetter;
        /**
         * Set an angular model validity through model.$setValidity. Changes the "model" state to manual
         * Calling this on a form has no effect.
         */
        validity(group: string, name: string, defs: IList<boolean>): angular.IPromise<IErrorMessage[]>;
        /**
         * Call $validate manually on the model(s) or form.
         * Calling on the form, will trigger $validate for all the children models
         */
        validate(group: string, name: string): angular.IPromise<IErrorMessage[]>;
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
        errors(group: string, pick: string[], errorArrays: boolean, predefine: any, helpers: boolean, reset: boolean): IList<IErrorHelper>;
        errors(group: string, pick: string[], errorArrays: boolean, predefine: any, helpers: boolean): IList<IErrorHelper>;
        errors(group: string, pick: string[], errorArrays: boolean, predefine: any): IList<IErrorGetterSetter>;
        errors(group: string, pick: string[], errorArrays: boolean): IList<IErrorMessage>;
        errors(group: string, pick: string[]): IList<IErrorMessage>;
        errors(group: string): IList<IErrorMessage>;
        /**
         * Resets the state of the forced errors on the models and update the errors array
         * Can reset an entire group at once, by only providing the group name
         */
        reset(group: string, name?: string, pick?: string[]): angular.IPromise<IErrorMessage[]>;
        /**
         * Forcefully set an error on the model, but don't change the ngModel.$error object
         */
        set(group: string, name: string, errors: IList<Function>, reset?: boolean): angular.IPromise<IErrorMessage[]>;
        set(group: string, name: string, errors: IList<string>, reset?: boolean): angular.IPromise<IErrorMessage[]>;
        set(group: string, name: string, errors: IList<boolean>, reset?: boolean): angular.IPromise<IErrorMessage[]>;
        get(group: string, name: string, helpers: boolean, predefine: any): IErrorHelper;
        get(group: string, name: string, helpers: boolean): IErrorHelper;
        get(group: string, name: string): IErrorModel;
        get(group: string): IErrorModels;
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
        label(group: string, item: Object): ErrorLookup;
        label(group: string, item: string, label: string): ErrorLookup;
        /**
         * Manually add a model, element, scopes to the service
         */
        add(options: IErrorAddOptions): IErrorModel;
        /**
         * Remove a model from ErrorLookup
         */
        remove(group: string, name?: string): angular.IPromise<void>;
        constructor($interpolate: angular.IInterpolateService, $q: angular.IQService, $http: angular.IHttpService, $timeout: angular.ITimeoutService, Provider: Providers.ErrorLookupProvider);
        static $inject: string[];
        static instance(Provider: Providers.ErrorLookupProvider, $interpolate: angular.IInterpolateService, $q: angular.IQService, $http: angular.IHttpService, $timeout: angular.ITimeoutService): ErrorLookup;
    }
}
export declare namespace Providers {
    class ErrorLookupProvider {
        messageQueue: IList<string>;
        $get: any[];
        /**
         * Add a message to be lazy-loaded
         */
        add<T extends {}>(name: T): ErrorLookupProvider;
        add(name: string, expr: any): ErrorLookupProvider;
        /**
         * ErrorLookupProvider options
         */
        options: any;
        /**
         * Remove a message so it won't be initialized when ErrorLookup gets injected
         */
        remove(name: string): ErrorLookupProvider;
        static instance(): (() => ErrorLookupProvider)[];
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
