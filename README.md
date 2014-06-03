AngularJS ErrorLookup
===================

Because AngularJS general error messages still suck. ngMessages can kiss my ass. 

TL;DR http://pocesar.github.io/angular-errorlookup

## Motivation

How is it better than `ngMessage` / `ngMessages`? Or plain old `ng-switch-when` / `ng-if` directive and a bunch of divs?

Because you need to write the same boring HTML markup over and over, and you need to cluttering your scope and controllers with useless state error messages. Plus, you are usually stuck with `modelController.$error` / `myForm.myModel.$error.required` / `myForm.$error.require[0].$error` (srsly wtf) boolean states.

Take this for example:

```html
<form name="userForm">
  <div class="field">
    <label for="emailAddress">Enter your email address:</label>
    <input type="email"
           name="emailAddress"
           ng-model="data.email"
           ng-minlength="5"
           ng-maxlength="30"
           required />

    <div ng-messages="userForm.emailAddress.$error">
      <div ng-message="required">You left the field blank...</div>
      <div ng-message="minlength">Your field is too short</div>
      <div ng-message="maxlength">Your field is too long</div>
      <div ng-message="email">Your field has an invalid email address</div>    
    </div>
  </div>
</form>
```

![EWW NOPE NOPE. Burn it with fire.](https://i.imgur.com/9utgk.gif)

And have you ever had to return validation from the server after a socket/ajax call and show it in your form? Tired of no way of assigning errors dynamically? Does your scope variables look like a mess with state errors?

**This module aims to provide a D.R.Y. interface for your errors, and.... are you ready for it?**

Interpolation! Make your errors beautiful and meaningful with magic. No more useless boring generic messages like "Please fill this field" and copy pasting divs all over the place or making a damn directive that adds them after each of your inputs, ffs.

## Usage

#### Provider

The `ErrorLookup` provider and service is that holds all messages and instances, models and attributes from your elements so it can be the ultimate overlord of your errors (and messages, but mostly errors).

```js
angular
.module('YourApp', ['ngErrorLookup'])
.config(['ErrorLookupProvider', function(ErrorLookupProvider){
  // ErrorLookupProvider allows you to remove/add/overwrite your messages before your controllers load
  ErrorLookupProvider.add('creditcard', 'The provided credit card isn\'t valid');
  ErrorLookupProvider.add('cvv', 'The CVV {{ model.$viewValue }} isn\'t valid for {{ scope.cardType }}');
}]);
.controller('MainCtrl', 
  ['$scope', 'ErrorLookup', 
  function($scope, ErrorLookup){
    // ErrorLookup is the full blown service
    ErrorLookup.messages.types.email({value: 'name'}); // name is not a valid email
    // Everything in types are a function from "$interpolate"
    // You can overwrite them by using:
    ErrorLookup.messages.add('email', 'O email "{{value}}" não é válido');
    ErrorLookup.messages.types.email({value: 'name'}); // O email "name" não é válido
  }
]);
```

But that's only for adding and manually setting error messages, which isn't useful for us, at all.

There are a couple of reflected attributes that is only an alias for the underlaying model, for convenience:

* `{{ value }}` is the same as `{{ model.$viewValue }}`

#### Directive

The `error-lookup` directive will add any `ng-model` or `ng-form` element to the bunch. By default, `error-lookup` group elements by scope, but you can set your own name using `error-lookup="mygroup"`

The `error-display` is a shortcut to the `ErrorLookup.error()` function. By default, the `error-display` must be in the same scope as the `error-lookup` directive, or it won't know where to look for errors. To specify another scope you need to pass another helper directive `error-scope="nameofscope"`, that can be an expression or a plain string. 

```html
<!-- add this element to our ErrorLookup service -->
<input ng-model="some.huge.ass.model.name" error-lookup="errorgroup1"> 
<!-- Display some nasty errors to the user -->
<ol error-display="some.huge.ass.model.name" error-scope="errorgroup1">
  <li>{{ latest }}</li> <!-- only one error at a time -->
  <li ng-repeat="error in errors">{{error}}</li> <!-- or show ALL the errors -->
</ol>
```

The `error-display` directive has 2 scope variables: 

* `latest`: that is the top most error for that field 
* `errors`: that is an array of all errors on the current model / form
