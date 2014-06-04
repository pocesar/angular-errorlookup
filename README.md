AngularJS ErrorLookup
===================

Because AngularJS general error messages still suck. ngMessages can kiss my ass. 

TL;DR http://pocesar.github.io/angular-errorlookup

## Motivation

How is it better than `ngMessage` / `ngMessages`? Or plain old `ng-switch-when` / `ng-if` directive and a bunch of divs?

Because you need to write the same boring HTML markup over and over, and you need to cluttering your scope and controllers with useless state error messages. Plus, you are usually stuck with `modelController.$error` / `myForm.myModel.$error.required` / `myForm.$error.require[0].$error` (srsly wtf) boolean states.

And have you ever had to return validation from the server after a socket/ajax call and show it in your form? Tired of no way of assigning errors dynamically? Does your scope variables look like a mess with state errors?

Take this _superb_ for example:

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

Now multiply that for 20 fields! Awesome right?

![NO NO NO NO! HELL NO!](https://i.imgur.com/9utgk.gif)

This doesn't tie you with a controller or directives, it's an application-wide error messages service with helper directives for the heavy lifting!

**This module aims to provide a D.R.Y. interface for your errors, and.... are you ready for it?**

Interpolation and callbacks! Make your errors beautiful and meaningful with magic. No more useless boring generic messages like "Please fill this field" for every 350 fields in your forms and copy pasting divs all over the place or making a damn directive that adds them after each of your inputs, and the need to use `$compile`, and all of the haX, like appending divs to DOM without you wanting it to.

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

Easily retrieve localized messages from the server:

```js
angular
.module('YourApp', ['ngErrorLookup'])
.run(['ErrorLookup', '$http', function(ErrorLookup, $http){
  $http.get('/error-messages.json').success(function(messages){
    // assuming your json structure is:
    
    /* 
      {
         "required": "Você precisa preencher este campo",
         "email": "O email \"{{ value }}\" é inválido",
         "blacklist": "O <strong>email</strong> não é permitido"
      }
     */
     
    for(var i in messages){
      ErrorLookup.messages.add(i, messages[i], 'html');
    }
  });
}])

// or just use the helper FFS
.run(['ErrorLookup', function(ErrorLookup){
  // Load ALL the messages
  ErrorLookup.messages.include('/error-messages.json').then(function(messages){
    // changing messages change them internally w00t
  }); 
}]);
```

But that's only for adding and manually setting error messages, which isn't much different from adding stuff to your controllers. We want moar. 

There are a couple of attributes you can display in your string messages:

* **`{{ label }}`**
 
  Pretty name of the model, instead of displaying "login.data.user.email" to the user,
  display something like "Your email"

* **`{{ model }}`** 

  The ngModel itself with all the bells and whistles, unchanged

* **`{{ attrs }}`**

  The $attrs from the current element with all the bells and whistles, unchanged
  You can even add CSS classes to the element through here, omg messy spaghetti! 

* **`{{ value }}`**

  Alias for the current model $viewValue

* **`{{ scope }}`**
  
  The assigned scope

* **`{{ models }}`**  

  ALL the models in the current group! Means you can reference other ngModels, how cool is that?

Since it uses interpolation, you always need to run the curryed function returned from the `ErrorLookup.error()`, since it has no watches and doesn't use `$compile` (that watch over expressions automatically):

```js
angular
.module('YourApp', ['ngErrorLookup'])
.controller('MainCtrl', 
  ['$scope', 'ErrorLookup', 
  function($scope, ErrorLookup) {
    $scope.error = ErrorLookup.error($scope.id, 'user.email'); 
    // this function changes the internal error array of the current model everytime it's called, plus it returns
    // the current error collection! (that is, an array of objects) So it's a setter AND a getter
    
    // Get ALL the errors in a group and assign them to the scope
    $scope.errors = ErrorLookup.errors($scope.id);
    // $scope.errors.user
    // $scope.errors.password
    // $scope.errors.repeat
    // $scope.errors.fullname
    // $scope.errors.email
    
    // plucking just a few members
    $scope.errors = ErrorLookup.errors($scope.id, ['user','password']);
    // $scope.errors.user
    // $scope.errors.password
    
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
  // You can even add CSS classes to the element through here, omg messy spaghetti! <3
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

Let the clusterfuck ensue! Break ALL the conventions! Access ALL the models! Wreck ALL the declarative behavior!

### API

#### Provider

##### `ErrorLookupProvider.add(name: String, expr: String|Function, trustedContext:String)`
  
Queue a message to be lazy initialized when the ErrorLookup service is instantiated for the first time.

##### `ErrorLookupProvider.remove(name: String)`
  
Remove a message from the queue.

#### Service

##### `ErrorLookup.error(group: String, name: String)`
  
Returns a function so you can control the error for that field. Executing the returning function 
returns an array with the errors (or an empty array if none). The errors are kept internally between 
calls per model. 

It's safe to assign the returning array from this, because the array always keep the
reference. 

Eg:
```js
// returns Function(Extra: Object)
ErrorLookup.error('group','user')({'required':true}); 
// returns [{name:'required',message:'You must fill your name',label:'your name'}] 
```

##### `ErrorLookup.errors(group: String, pick: Array = [])`

Returns an object with all the error functions from above. If you define an array in pick, you can retrieve
only some members of the group.
  
Eg:
```js
ErrorLookup.errors('group',['user','email']); // returns {'user':Function,'email':Function}
```
  
##### `ErrorLookup.remove(group: String, name: String)`

Remove the model from the errors pile

Eg:
```js
ErrorLookup.remove(scope.$id, 'user');
```

##### `ErrorLookup.add(scope: Scope, name: String, model: ngModel, attr: $attr, groupName: String, label: String)`

This method is boring as hell. Long parameter list and you shouldn't need to call it manually if you use the
directives. You need to provide everything to the function or it breaks.

* `scope`: the current scope
* `name`: the name of the ng-model, it automatically defaults to the string inside `ng-model="this.one.here"`
* `model`: the model itself (ngModelController) or ngFormController if you add a form model to it
* `attr`: the $attrs of the element
* `groupName`: the name of the model. Defaults to attrs.ngModel if not provided
* `label`: the label to give the error. Defaults to empty string

#### `ErrorLookup.messages`

Keeps your application wide messages in a repository

##### `ErrorLookup.messages.add(name: String, expr: String|Function, trustedContext: String)`
  
Adds a message. Accepts a function (callback!) or a interpolated string. If you set `trustedContext` to 'html'
it will use the `$sce` service and accept safe HTML in your interpolated string. 
  
Eg:
```js
ErrorLookup.messages.add('required', '<span class="well">You need to fill this field</span>', 'html');
```

Returns the current `$interpolate`d string or the function you passed, you can call it right way.

##### `ErrorLookup.messages.remove(name: String)`
   
Remove a message from the service
  
Eg:
```js
ErrorLookup.messages.remove('required'); // all required errors will never be displayed =(
```
  
##### `ErrorLookup.messages.include(url: String)`
   
Loads a JSON representation of your messages.
Returns a promise. If you modify the resulting value, you can modify the included messages

Eg:
```js
ErrorLookup.messages.include('/messages.json').then(function(messages){
  delete messages['required'];
});
```
  
#### Directives

The `error-lookup` directive will add any `ng-model` or `ng-form` element to the bunch. By default, `error-lookup` group elements by `scope.$id`, but you can set your own name using `error-lookup="mygroup"` (it's preferable this way)

The `error-display` is a shortcut to the `ErrorLookup.error()` function. By default, the `error-display` must be in the same scope as the `error-lookup` directive for it to inherit data from the scope, or it won't know where to look for errors. To specify another group name you need to pass an attribute `error-group="name of group"`. 

```html
<!-- add this element to our ErrorLookup service -->
<input ng-model="some.huge.ass.model.name" error-lookup="errorgroup1" error-model="modelname" type="email"> 

<!-- Display some nasty errors to the user -->
<ol error-display="modelname" error-group="errorgroup1" error-label="your email">
  <li>{{ latest.message }}</li> <!-- only the latest error in the stack -->
  <li ng-repeat="error in errors">{{error.message}}</li> <!-- or show ALL the errors -->
  <!-- you can even make your shit clickable -->
  <li ng-repeat="error in errors" ng-click="myWorldController.click(error)" ng-bind-html="error.message"></li> 
</ol>

<!-- you can put it on forms, and ALL your ng models will be added -->
<form error-lookup name="fuck">
  <input ng-model="doh">
  <input ng-model="srsly">
  <input ng-model="input">
</form>
```

The `error-display` directive has 2 scope variables: 

* `latest`: that is the top most error for that field, containing `name`, `message` and `label`
* `errors`: that is an array of all errors on the current model / form, in the format `[{name: String, message: String, label: String}]`

Since the scope isn't isolated, but a child scope, it inherits from the current scope it's in, so primitives are NOT updated, only arrays and objects. 
