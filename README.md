AngularJS ErrorLookup
===================

Because AngularJS general error messages still suck. ngMessages can kiss my ass.

## Usage

#### Service

The `ErrorLookup` service that holds all messages and instances, models and attributes from your elements so it can be the ultimate overlord of your errors (and messages, but mostly errors).



#### Directive

The `error-lookup` directive will add any `ng-model` or `ng-form` element to the bunch. By default, `error-lookup` group elements by scope, but you can set your own name using `error-lookup="mygroup"`

The `error-display` is a shortcut to the `ErrorLookup.error()` function. By default, the `error-display` must be in the same scope as the `error-lookup` directive, or it will always show an empty. To specify another scope you need to pass another helper directive `error-scope="nameofscope"`, that can be an expression or a plain string. 

```html
<!-- add this element to our ErrorLookup service -->
<input ng-model="some.huge.ass.model.name" error-lookup="fakescope"> 
<!-- Display some nasty errors to the user -->
<ol error-display="some.huge.ass.model.name" error-scope="fakescope">
  <li>{{ latest }}</li>
  <li ng-repeat="error in errors">{{error}}</li>
</ol>
```
