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
  ErrorLookupProvider.add('repeated', 'The value {{ value }} doesn\'t match {{ models.fucker.model.$viewValue }}');
}])
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

Retrieve localized messages from the server:

```js
angular
.module('YourApp', ['ngErrorLookup'])
.run(['ErrorLookup', '$http', function(ErrorLookup, $http){
  $http.get('error-messages.json').success(function(messages){
    // assuming your json structure is:
    /* 
      {
         "required": "Você precisa preencher este campo",
         "email": "O email \"{{ value }}\" é inválido",
         "blacklist": "O email não é permitido"
       }
     */
    for(var i in messages){
      ErrorLookup.messages.add(i, messages[i], 'html');
    }
  });
}])
```

But that's only for adding and manually setting error messages, which isn't useful for us, at all.

There are a couple of reflected attributes that is only an alias for the underlaying model, for convenience:

* `{{ value }}` is the same as `{{ model.$viewValue }}`

Since it uses interpolation, you always need to run the curryed function returned from the `ErrorLookup.error()`, since it has no watches and doesn't use `$compile` (that watch over expressions automatically):

```js
angular
.module('YourApp', ['ngErrorLookup'])
.controller('MainCtrl', 
  ['$scope', 'ErrorLookup', 
  function($scope, ErrorLookup) {
    $scope.error = ErrorLookup.error($scope.id, 'user.email'); 
    // this function changes the internal error array of the current model
    
    // or the controller-bound preferred way
    this.error = ErrorLookup.error('group', 'full.qualified.modelname.as.written.in.ng-model');
  }
]);
```

`ErrorLookup.error(group, modelIdentifier)` return a function that has the following signature `function(extra)`.
Effectively, you can trigger new errors without the error being present on the model, like when you return validation from the server.

```js
$http.post('/isValid', {type: 'email', email: $scope.email}).success(function(errors){
  if (errors !== false) {
    $scope.error(errors); // assuming errors = {'blacklist': true, 'required': true}
    
    // if you assign an string, it will be shown instead of the predefined messages
    $scope.error({
      'blacklist': 'You failed to enter your email, {{value}} even make sense to you? You dirty spammer'
    }); // $interpolates this on the fly, not healthy for performance, beware
  }
});
```

But wait! You don't need to add an string that will be interpolated, you can use a function!

```js
ErrorLookup.messages.add('dynamic', function(model){
  // Pretty name of the model, instead of displaying "login.data.user.email" to the user,
  // display something like "Your email"
  // model.label
  
  // The ngModel itself with all the bells and whistles, unchanged
  // model.model 
  
  // The $attrs from the current element with all the bells and whistles, unchanged
  // model.attrs 
  
  // Alias for the current model $viewValue
  // model.value 
  
  // The assigned scope / group
  // model.scope 
  
  // ALL the models in the current group!
  // model.models
  
  // You must return an string here. Interpolate if you want, ErrorLookup don't care
  return 'You failed';
});
```

Let the cluster fuck ensue! Break ALL the conventions! Access ALL the models!

#### Directive

The `error-lookup` directive will add any `ng-model` or `ng-form` element to the bunch. By default, `error-lookup` group elements by scope, but you can set your own name using `error-lookup="mygroup"` (it's preferable this way, although scope ids are unique)

The `error-display` is a shortcut to the `ErrorLookup.error()` function. By default, the `error-display` must be in the same scope as the `error-lookup` directive, or it won't know where to look for errors. To specify another scope you need to pass an attribute `error-scope="nameofscope"`, that can be an expression or a plain string. 

```html
<!-- add this element to our ErrorLookup service -->
<input ng-model="some.huge.ass.model.name" error-lookup="errorgroup1"> 
<!-- Display some nasty errors to the user -->
<ol error-display="some.huge.ass.model.name" error-scope="errorgroup1">
  <li>{{ latest.message }}</li> <!-- only the latest error in the stack -->
  <li ng-repeat="error in errors">{{error.message}}</li> <!-- or show ALL the errors -->
  <!-- you can even make your shit clickable -->
  <li ng-repeat="error in errors" ng-click="myWorldController.click(error)" ng-bind-html="error.message"></li> 
</ol>
```

The `error-display` directive has 2 scope variables: 

* `latest`: that is the top most error for that field, containing `name`, `message` and `label`
* `errors`: that is an array of all errors on the current model / form, in the format `[{name: String, error: String, label: String}]`

Since the scope isn't isolated, but a child scope, it inherits from the current scope it's in, so primitives are NOT updated, only arrays and objects. 
