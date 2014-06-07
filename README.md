[![Build Status](https://travis-ci.org/pocesar/angular-errorlookup.svg?branch=master)](https://travis-ci.org/pocesar/angular-errorlookup?branch=master)

AngularJS ErrorLookup
===================

Because AngularJS general error messages still suck. ngMessages can kiss my ass. 

TL;DR http://pocesar.github.io/angular-errorlookup

## Motivation

How is it better than `ngMessage` / `ngMessages`? Or plain old `ng-switch-when` / `ng-if` directive and a bunch of divs?

Because you need to write the same boring HTML markup over and over, and you need to cluttering your scope and controllers with useless state error messages. Plus, you are usually stuck with `modelController.$error` / `myForm.myModel.$error.required` / `myForm.$error.require[0].$error` (srsly wtf) boolean states. 

It's nearly impossible to `$setValidity` without a helper directive that has access to some sort of global state, since the ngModel controllers and form controllers are only available inside directives that require them. Even worse when you  you have to return validation from the server after a socket/ajax call and show it in your form / models. 

So, are tired of no way of assigning errors dynamically, bypassing them when necessary? Does your scope variables look like a mess with state errors? Show a simple plain string on a form or console? 

Take this _superb_ code for example:

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

This doesn't tie you with a controller or directives, and it doesn't aim to provide you a validation interface. 

**This module aims to provide a D.R.Y. service for your errors**

It's an application-wide error messages service with helper directives for the heavy lifting! ngMessages doesn't offer you a way to programatically set errors (unless you create a directive that requires ngModel and ngMessages, and you do the bridge, aka, hot mess). You can use it in your DOM in a declarative manner, in your controller(s), in your directive(s), in other services, it keeps all your error messages under complete control (along with access to the bound element, scope and attributes).

Best of all: interpolation and callbacks! Make your errors beautiful and meaningful with magic. No more useless boring generic messages like "Please fill this field" for every 350 fields in your forms and copy pasting divs all over the place or making a damn directive that adds them after each of your inputs, and the need to use `$compile`, and all of the haX, like appending divs to DOM without you wanting it to.

## Usage

### Provider and Service

The `ErrorLookup` provider and service is that holds all messages and instances, models and attributes from your elements so it can be the ultimate overlord of your errors (and messages, but mostly errors, since it checks the `$error` member of the controller).

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
//  just use the helper FFS
// assuming your json structure is:

/* 
  {
     "required": "Você precisa preencher este campo",
     "email": "O email \"{{ value }}\" é inválido",
     "blacklist": "O <strong>email</strong> não é permitido"
  }
 */
.run(['ErrorLookup', function(ErrorLookup){
  // Load ALL the messages
  ErrorLookup.messages.include('/error-messages.json').then(function(messages){
    // changing messages change them internally w00t
  }); 
}]);
```

But that's only for adding and manually setting error messages, which isn't much different from adding stuff to your controllers. We want moar. 

There are a couple of attributes you can display in your string messages:

###### **`{{ label }}`**
 
Pretty name of the model, instead of displaying "login.data.user.email" to the user, display something like "Your email"

###### **`{{ model }}`** 

The ngModel itself with all the bells and whistles, unchanged

###### **`{{ attrs }}`**

The $attrs from the current element with all the bells and whistles, unchanged
You can even add CSS classes to the element through here, omg messy spaghetti! 

###### **`{{ value }}`**

Alias for the current model $viewValue

###### **`{{ scope }}`**
  
The assigned scope

###### **`{{ models }}`**  

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
    // <div ng-bind="error()"></div>
    
    // Get ALL the errors in a group and assign them to the scope
    $scope.errors = ErrorLookup.errors($scope.id);
    // $scope.errors.user
    // $scope.errors.password
    // $scope.errors.repeat
    // $scope.errors.fullname
    // $scope.errors.email
    // <div ng-bind="errors.user()"></div>
    
    // plucking just a few members
    $scope.errors = ErrorLookup.errors($scope.id, ['user','password']);
    // $scope.errors.user
    // $scope.errors.password
    
    // or the controller-bound preferred way
    this.error = ErrorLookup.error('group', 'full.qualified.modelname.as.written.in.ng-model');
  }
]);
```

`ErrorLookup.error(group, modelIdentifier, predefine)` return a function that has the following signature `function(extra)`.
Effectively, you can trigger new errors without the error being present on the model, like when you return validation from the server, without using `model.$setValidity`, although you can.

```js
$http.post('/isValid', {type: 'email', email: $scope.email}).success(function(errors){
  if (errors !== false) {
    $scope.error(errors); // assuming errors = {'blacklist': true, 'required': true}
    // will look for default blacklist and required messages
    
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
  // model is the programmatically equivalent of the scope variables in your interpolated string above
  // "this" context is the internal "model" 
  var error;
  for(var i = 0; i < this.item.errors.length; i++) {
    error = this.item.errors[i];
    if (error.type === 'required') {
      switch (this.name){
        case 'model1':
          return 'reqqqq';
        case 'model2':
          return 'reqirueiruei';
      }
    } else if (error.type === 'email') {
      switch (this.name){
        case 'model1':
          return 'Dubudbudubu';
        case 'model2':
          return 'Wooobblebblle';
      }
    }
  }
  // You must return an string here. Interpolate if you want, ErrorLookup don't care
  return 'You failed';
});
```

So let the clusterfuck ensue! Break ALL the conventions! Access ALL the models! Pass ALL elements to callbacks! Wreck ALL the declarative behavior!

### API

#### Provider

###### `ErrorLookupProvider.add(name: String, expr: String|Function, trustedContext:String)`
  
Queue a message to be lazy initialized when the ErrorLookup service is instantiated for the first time.

```js
ErrorLookupProvider.add('required','<strong>{{ label }}</strong> is awesome, you gotta fill it', 'html');
ErrorLookupProvider.add('hallelujah','praise almighty code');
```

###### `ErrorLookupProvider.remove(name: String)`
  
Remove a message from the queue.

```js
ErrorLookupProvider.remove('required');
```

#### Service

###### `ErrorLookup.error(group: String, name: String, predefine: Object)`
  
Returns a function so you can control the error for that field. Executing the returning function 
returns an array with the errors (or an empty array if none). The errors are kept internally between 
calls per model. 

It's safe to assign the returning array from this, because the array always keep the
reference to the same memory object. 

```js
// fn is Function(Extra: Object|Boolean): Array
var fn = ErrorLookup.error('group','user');
fn({'required':true}); 
/* returns */
[
  { 
    type:'required',
    message:'You must fill user',
    label:'user', 
    name:'user',
    item:Model
  }
] 
```

You can also bypass the current messages that are set for a particular model, making it unique for the same error type

```js
// fn is Function(Extra: Object|Boolean): Array
var fn = ErrorLookup.error('group','user',{'required':'User is sooo required, please fill me in'});
fn({'required':true}); 
/* returns */
[
  { 
    type:'required',
    message:'User is sooo required, please fill me in',
    label:'user', 
    name:'user',
    item:Model
  }
] 
```

And you can bypass the bypass! 

```js
// fn is Function(Extra: Object|Boolean): Array
var fn = ErrorLookup.error('group','user',{'required':'User is sooo required, please fill me in'});
fn({'required':'w00t'}); 
/* returns */
[
  { 
    type:'required',
    message:'w00t',
    label:'user', 
    name:'user',
    item:Model
  }
] 
```

###### `ErrorLookup.errors(group:String, pick:Array = [], arrays:Boolean = false, predefine:Object = {})`

Returns an object with all the error functions from above. If you define an array in pick, you can retrieve
only some members of the group.
  
```js
var errors = ErrorLookup.errors('group',['user','email']); // returns {'user':ErrorGetterFunction,'email':ErrorGetterFunction}
errors.user(); // [{type:'required'...}]
```

setting arrays to true return the internal error arrayreference:

```js
var errors = ErrorLookup.errors('group',['user','email']); // returns {'user':Array,'email':Array}
errors.user; // [{type:'required'...}]
// the ErrorLookup.error() must be called somewhere for this array to be filled
```

You can override the default errors of a group:

```js
var errors = ErrorLookup.errors('group', [], false, {'required':'w00b'}); // returns {'user':ErrorFunction,'email':ErrorFunction,'password':ErrorFunction}
errors.email({required: true}); // [{type:'required','message':'w00b'}]
errors.password({required: true}); // [{type:'required','message':'w00b'}]
```
  
###### `ErrorLookup.remove(group: String, name: String)`

Remove the model from the errors pile

```js
ErrorLookup.remove(scope.$id, 'user');
```

###### `ErrorLookup.add(config:Object)`

This method is boring as hell. Long parameter list and you shouldn't need to call it manually if you use the
directives. You need to always provide non-optional stuff everytime to the function or it breaks.

The config object is as following:

`config.scope` : the scope. [Not Optional]
`config.name`  : the name of the ng-model, or any internal name you want to use. it must exist in the given scope [Not Optional]
`config.model` : the model itself ngModelController (or ngFormController if you add a form model to it) [Not Optional]
`config.attrs` : the $attrs of the element, you can pass an object too when not adding from inside a directive
`config.group` : the group name, fallbacks to using `scope.$id`
`config.label` : the label to give the error. Defaults to the name of the model. pretty name for your `login.data.user` as `Your username` for example
`config.el`    : assign a DOM element to the current model

```js
/* ... */
.directive('blah', function(ErrorLookup){
  return {
    require:'ngModel',
    link: function($scope, el, attr, ctrl){
    
      ErrorLookup.add({
        scope: $scope,
        name : attr.ngModel,
        model: ctrl,
        el   : el
      });
    }
  }
});
```

##### `ErrorLookup.messages`

Keeps your application wide messages in a repository

###### `ErrorLookup.messages.add(name: String, expr: String|Function, trustedContext: String)`
  
Adds a message. Accepts a function (callback!) or a interpolated string. If you set `trustedContext` to 'html'
it will use the `$sce` service and accept safe HTML in your interpolated string. 
  
```js
ErrorLookup.messages.add('required', '<span class="well">You need to fill this field</span>', 'html');
```

Returns the current `$interpolate`d string or the function you passed, you can call it right way.

###### `ErrorLookup.messages.remove(name: String)`
   
Remove a message from the service
  
```js
ErrorLookup.messages.remove('required'); // all "required" error messages, will be silently skipped when this error is present on ngModel =(
```
  
###### `ErrorLookup.messages.include(url: String)`
   
Loads a JSON representation of your messages.
Returns a promise. If you modify the resulting value, you can modify the included messages

```js
ErrorLookup.messages.include('/messages.json').then(function(messages){
  delete messages['required'];
});
```
  
#### Directives

The `error-lookup` directive will add any `ng-model` or `ng-form` element to the bunch. By default, `error-lookup` group elements by `scope.$id`, but you can set your own name using `error-lookup="mygroup"` (it's preferable this way, so you can reuse in your code)

The `error-display` is a shortcut to the `ErrorLookup.error()` function. By default, the `error-display` must be in the same scope as the `error-lookup` directive for it to inherit data from the scope, or it won't know where to look for errors. 

But when you can get around this by specifying a string group name to `error-lookup`, you can pass an attribute `error-group="mygroup"`, then it knows where to look and you can reuse the same "address" in your controllers, services and other directives. 

```html
<!-- add this element to our ErrorLookup service -->
<input ng-model="some.huge.ass.model.name.thatis.your.email" error-lookup-label="your email" error-lookup="login.interface" error-lookup-name="email" type="email" required> 
<!-- You can, inside your controller, now use ErrorLookup.get('login.interface','email'), and even have access to this element lol, breaking conventions since 2014 -->

<!-- Display some nasty errors to the user -->
<ol error-display="email" error-group="login.interface">
  <li>{{ latest.message }}</li> <!-- only the latest error in the stack -->
  <li ng-repeat="error in errors()">{{error.message}}</li> <!-- or show ALL the errors -->
  <!-- you can even make your shit clickable -->
  <li ng-repeat="error in errors()" ng-click="myWorldController.click(error)" ng-bind-html="error.message"></li> 
</ol>

<!-- you can put it on forms, you can display errors for your form as a whole -->
<form error-lookup name="fuck">
  <input ng-model="doh">
  <input ng-model="srsly">
  <input ng-model="input">
</form>
```

The `error-display` directive has 2 scope variables: 

###### `latest`

Is the top most error for that field, containing the fields described in [ErrorLookup.error()](#errorlookuperrorgroup-string-name-string-predefine-object)

###### `errors`

Is the function of all errors on the current model / form, in the format, you can override messages in here as you would in `ErrorLookup.error()({required:'holy mother of code'})`:

```html
<ol error-display="email" error-group="login.interface">
  <li ng-repeat="error in errors({'required':'holy mother of code'})">{{error.label}}: {{ error.message }}</li>
</ol>
```

Since the scope isn't isolated, but a child scope, it inherits from the current scope it's in, make sure to understand scope inheritance before you try your hax0rs in the code. 
