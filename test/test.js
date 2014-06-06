"use strict";

describe('ErrorLookup', function (){

  beforeEach(module('ngErrorLookup'));

  // Provider

  describe('provider', function (){
    afterEach(inject); // hack so when module() only "its" instantiate the provider

    it('exists', function (){
      module(function (ErrorLookupProvider){
        expect(ErrorLookupProvider).to.be.ok();
        expect(ErrorLookupProvider.$get).to.be.an('array');
        expect(ErrorLookupProvider.add).to.be.a('function');
        expect(ErrorLookupProvider.remove).to.be.a('function');
      });
    });

    it('adds messages to the queue', function (){
      module(function (ErrorLookupProvider){
        var eql = {
          expr          : 'dummy',
          trustedContext: void 0
        };

        expect(ErrorLookupProvider.add('dummy', 'dummy')).to.be(ErrorLookupProvider);
        expect(ErrorLookupProvider.messageQueue.dummy).to.eql(eql);
      });
    });

    it('removes messages from the queue', function (){
      module(function (ErrorLookupProvider){

        expect(ErrorLookupProvider.add('dummy', 'dummy').remove('dummy')).to.be(ErrorLookupProvider);
        expect(ErrorLookupProvider.messageQueue.dummy).to.be.an('undefined');
      });
    });

    it('injecting initializes the messages', function (){
      var queue;

      module(function (ErrorLookupProvider){
        ErrorLookupProvider.add('clumsy', 'dummy');
        queue = ErrorLookupProvider.messageQueue;
      });

      inject(function (ErrorLookup){
        expect(ErrorLookup.messages.types).to.not.be.empty();
        expect(ErrorLookup.messages.types.clumsy).to.be.a('function');
        expect(ErrorLookup.messages.types.clumsy()).to.be('dummy');
        expect(queue.clumsy).to.eql({
          expr          : 'dummy',
          trustedContext: undefined
        });
      });
    });
  });

  // Service

  describe('service', function (){

    it('exists', inject(function (ErrorLookup){
      expect(ErrorLookup).to.be.ok();
    }));

    describe('messages', function (){

      it('$interpolate message strings', inject(function (ErrorLookup){

        expect(ErrorLookup.messages.add('dummy', 'dummy!')).to.be.a('function');
        expect(ErrorLookup.messages.types.dummy()).to.be('dummy!');
      }));

      it('callback on function', function (done){
        inject(function (ErrorLookup){
          var fn = function (f){
            expect(f).to.be(true);
            done();
          };

          expect(ErrorLookup.messages.add('dummy', fn)).to.be.a('function');

          ErrorLookup.messages.types.dummy(true);
        });
      });

      it('ignores invalid parameters', inject(function (ErrorLookup){
        ErrorLookup.messages.add('dummy', false);
        expect(ErrorLookup.messages.types.dummy).to.be.an('undefined');

        ErrorLookup.messages.add('dummy', {required: true});
        expect(ErrorLookup.messages.types.dummy).to.be.an('undefined');

        ErrorLookup.messages.add('dummy', 0);
        expect(ErrorLookup.messages.types.dummy).to.be.an('undefined');
      }));

      describe('include', function(){
        var $httpBackend;

        beforeEach(inject(function($injector){
          $httpBackend = $injector.get('$httpBackend');
          $httpBackend.when('GET', '/messages.json').respond(200, {required:'fill {{ field }}',email:'not an email'});
        }));

        it('loads and manipulates messages', function(done){

          inject(function(ErrorLookup, $templateCache){
            ErrorLookup.messages.include('/messages.json').then(function(messages){
              delete messages['min'];

              expect($templateCache.get('/messages.json')).to.be.ok();

              expect(ErrorLookup.messages.types.min).to.be.an('undefined');
              expect(ErrorLookup.messages.types.required({field: 'lol'})).to.be('fill lol');
              expect(ErrorLookup.messages.types.email()).to.be('not an email');

            }).then(done);

            $httpBackend.flush();
          });
        });

        afterEach(function(){
          $httpBackend.verifyNoOutstandingExpectation();
          $httpBackend.verifyNoOutstandingRequest();
        });
      });


    });

    describe('errors', function (){

      var createModel;
      beforeEach(function (){

        inject(function ($compile, $rootScope){
          createModel = function (name, $scope, el, controller){
            if (!$scope) {
              $scope = $rootScope.$new();
            }

            var
              element = angular.element(el || '<input ng-model="' + name + '">'),
              compileFn = $compile(element),
              compiled = compileFn($scope);

            return {
              name      : name,
              element   : element,
              scope     : $scope,
              controller: compiled.controller(controller || 'ngModel')
            };
          };
        });

      });

      it('adds an ngModel and ngForm to the bunch', function (){
        inject(function (ErrorLookup){
          var
            input = createModel('dummy'),
            form = createModel('frm', input.scope, '<form></form>', 'form');

          var added = ErrorLookup.add(input.scope, input.name, input.controller, {});
          expect(added.error).to.be.a('function');
          expect(added.remove).to.be.a('function');
          expect(added.item.model).to.be(input.controller);
          expect(ErrorLookup.get(input.scope.$id, input.name)).to.be(added.item);
          expect(added.item.model.$setViewValue).to.be.a('function');

          added = ErrorLookup.add(form.scope, form.name, form.controller, {});
          expect(added.error).to.be.a('function');
          expect(added.remove).to.be.a('function');
          expect(added.item.model).to.be(form.controller);
          expect(ErrorLookup.get(form.scope.$id, form.name)).to.be(added.item);
          expect(added.item.model.$addControl).to.be.a('function');
        });
      });

      it('reflects errors on the array on input', function (){
        inject(function (ErrorLookup){
          ErrorLookup.messages.add('required', 'fill it');

          var
            input = createModel('dummy', false, '<input ng-model="dummy" required>');

          var added = ErrorLookup.add(input.scope, input.name, input.controller, {});

          input.scope.$digest();

          expect(added.error()).to.eql([
            {
              type   : 'required',
              model  : added.item.model,
              name   : 'dummy',
              message: 'fill it',
              label  : 'dummy'
            }
          ]);
        });
      });

      it('has a bunch of helpers in the interpolated string', inject(function (ErrorLookup){
        ErrorLookup.messages.add('required', '{{ value }}_{{ label }}_{{ models.dummy.model.$modelValue }}_{{ scope.$id }}_{{ model.$modelValue }}');
        ErrorLookup.messages.add('email', '{{ model.$modelValue }}!! {{ scope.isSet() }}');

        var
          input = createModel('dummy', false, '<input ng-model="dummy" required type="email">');

        var added = ErrorLookup.add(input.scope, input.name, input.controller, {});

        input.scope.dummy = 'adf';
        input.scope.isSet = function (){ return true; };

        input.scope.$digest();

        var errors = added.error();
        expect(errors).to.have.length(2);
        expect(errors[0].message).to.match(/adf_dummy_adf_[^\_]+_adf/);
        expect(errors[1].message).to.be('adf!! true');
      }));

      it('executes the callback instead of interpolated string', inject(function (ErrorLookup, $interpolate){
        ErrorLookup.messages.add('required', function (model){
          return $interpolate('WOW {{ loled }}')(model.scope);
        });

        var
          input = createModel('dummy', false, '<input ng-model="dummy" required>');

        ErrorLookup.add(input.scope, input.name, input.controller, {});

        input.scope.loled = 'I loled!';
        input.scope.$digest();

        var errors = ErrorLookup.get(input.scope.$id, input.name, true);

        expect(errors.error()).to.eql([
          {
            type   : 'required',
            message: 'WOW I loled!',
            model  : errors.item.model,
            name   : 'dummy',
            label  : 'dummy'
          }
        ]);

      }));

      it('empty array on no errors', inject(function (ErrorLookup){
        var
          input = createModel('dummy', false, '<input ng-model="dummy" required>');

        var added = ErrorLookup.add(input.scope, input.name, input.controller, {});

        input.scope.dummy = 'its empty';
        input.scope.$digest();

        expect(added.error()).to.eql([]);
        expect(added.item.errors).to.eql([]);
        expect(added.item.errors).to.be(added.error());
      }));

      describe('form', function (){
        it('empty array on no errors', inject(function (ErrorLookup){
          var
            frm = createModel('frm', false, '<form><input ng-model="dummy"></form>', 'form');

          var added = ErrorLookup.add(frm.scope, frm.name, frm.controller, {});

          frm.scope.$digest();

          expect(added.error()).to.eql([]);
          expect(added.item.errors).to.eql([]);
          expect(added.item.errors).to.be(added.error());
        }));

        it('display errors from sub models', inject(function (ErrorLookup){
          var
            frm = createModel('frm', false, '<form><input ng-model="dummy" required></form>', 'form');

          var added = ErrorLookup.add(frm.scope, frm.name, frm.controller, {});

          frm.scope.$digest();

          var eql = [
            {
              type   : 'required',
              message: 'You must fill this field',
              model  : added.item.model.$error.required[0],
              name   : 'frm',
              label  : 'frm'
            }
          ];

          expect(added.error()).to.eql(eql);
          expect(added.item.errors).to.eql(eql);
          expect(added.item.errors).to.be(added.error());

          frm.scope.dummy = 'asdf';
          frm.scope.$digest();

          expect(added.error()).to.eql([]);

          frm = createModel('frm', false, '<form><input ng-model="dummy" name="named" required><input ng-model="email" name="email" type="email"></form>', 'form');
          added = ErrorLookup.add(frm.scope, frm.name, frm.controller, {});
          frm.scope.email = 'asdf';
          frm.scope.$digest();

          expect(added.error()).to.eql([
            {
              type   : 'required',
              message: 'You must fill named',
              model  : added.item.model.$error.required[0],
              name   : 'frm',
              label  : 'named'
            },
            {
              type   : 'email',
              message: 'asdf is not a valid email',
              model  : added.item.model.$error.email[0],
              name   : 'frm',
              label  : 'email'
            }
          ]);

          expect(added.error({required: 'aloha'})).to.eql([
            {
              type   : 'required',
              message: 'aloha',
              model  : added.item.model,
              name   : 'frm',
              label  : 'frm'
            },
            {
              type   : 'email',
              message: 'asdf is not a valid email',
              model  : added.item.model.$error.email[0],
              name   : 'frm',
              label  : 'email'
            }
          ]);
        }));

        it('display errors from sub models with labels', inject(function (ErrorLookup){
          var
            frm = createModel('frm', false, '<form><input ng-model="dummy" name="dummy" required></form>', 'form');

          var added = ErrorLookup.add(frm.scope, 'NAME', frm.controller, {}, false, 'My Form');

          added.label('dummy', 'Some field');

          frm.scope.$digest();

          expect(added.error()).to.eql([
            {
              type   : 'required',
              model  : added.item.model.$error.required[0],
              message: 'You must fill Some field',
              name   : 'My Form',
              label  : 'Some field'
            }
          ]);
        }));
      });

      it('force errors to the model, without touching its value and without changing its state', inject(function (ErrorLookup){
        var
          input = createModel('dummy', false, '<input ng-model="dummy">');

        var added = ErrorLookup.add(input.scope, 'OMG', input.controller, {'ngModel': 'dummy'});

        input.scope.dummy = 'hooray!';
        input.scope.$digest();

        expect(added.error({'notyet': true})).to.eql([]);

        ErrorLookup.messages.add('model', 'The model is {{ attrs.ngModel }} with value {{ value }}');

        expect(added.error({'model': true})).to.eql([
          {
            type   : 'model',
            message: 'The model is dummy with value hooray!',
            model  : added.item.model,
            label  : 'OMG',
            name   : 'OMG'
          }
        ]);
      }));

      it('accepts the first available controller it finds', inject(function(ErrorLookup){
        var
          input = createModel('dummy', false, '<input ng-model="dummy">');

        var added = ErrorLookup.add(input.scope, 'OMG', [undefined, undefined, input.controller], {'ngModel': 'dummy'});

        expect(added.item.model).to.be(input.controller);
      }));

      it('has scope and group name', inject(function(ErrorLookup){
        var
          input = createModel('dummy'),
          input2 = createModel('clumsy', input.scope)
          ;

        var added = [
          ErrorLookup.add(input.scope, input.name, input.controller, {}, 'somegroup', 'main'),
          ErrorLookup.add(input2.scope, input2.name, input2.controller, {}, 'somegroup', 'another')
        ];

        var obj = ErrorLookup.errors('somegroup');
        expect(obj.dummy).to.be.a('function');
        expect(obj.clumsy).to.be.a('function');
        expect(obj.dummy()).to.be(added[0].error());
        expect(obj.clumsy()).to.be(added[1].error());

        obj = ErrorLookup.errors('somegroup',['dummy']);
        expect(obj.clumsy).to.be.an('undefined');

        obj = ErrorLookup.errors('somegroup', false, true);

        expect(obj.dummy).to.be.an('array');
        expect(obj.clumsy).to.be.an('array');
      }));

      it('keep reference', inject(function(ErrorLookup){
        var
          input = createModel('name');

        ErrorLookup.add(input.scope, input.name, input.controller, {}, 'group');

        var errors = ErrorLookup.get('group','name').errors;

        expect(errors).to.be.an('array');
        expect(errors).to.have.length(0);

        ErrorLookup.error('group','name')({required: true});

        expect(errors).to.have.length(1);
        expect(ErrorLookup.error('group','name')({required: true}, true)).to.be(errors);
        expect(ErrorLookup.errors('group',['name'],true)).to.eql({
          name: errors
        });
      }));

      it('returns empty object on invalid group', inject(function(ErrorLookup){
        expect(ErrorLookup.errors('invalid')).to.eql({});
      }));

      it('returns empty object on invalid picks', inject(function(ErrorLookup){
        var
          input = createModel('name');

        ErrorLookup.add(input.scope, input.name, input.controller, {});

        expect(ErrorLookup.errors(input.scope.$id,['nope','nope','nope'])).to.eql({});
      }));
    });

  });

  describe('directives', function (){

  });
});
