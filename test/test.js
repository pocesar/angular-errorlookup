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
              type    : 'required',
              message : 'You must fill named',
              model   : added.item.model.$error.required[0],
              name    : 'frm',
              label   : 'named'
            },
            {
              type   : 'email',
              message: 'asdf is not a valid email',
              model   : added.item.model.$error.email[0],
              name   : 'frm',
              label  : 'email'
            }
          ]);

          expect(added.error({required:'aloha'})).to.eql([
            {
              type: 'required',
              message: 'aloha',
              model: added.item.model,
              name:'frm',
              label:'frm'
            },
            {
              type: 'email',
              message: 'asdf is not a valid email',
              model: added.item.model.$error.email[0],
              name:'frm',
              label:'email'
            }
          ]);
        }));

        it('display errors from sub models with labels', inject(function (ErrorLookup){
          var
            frm = createModel('frm', false, '<form><input ng-model="dummy" name="dummy" required></form>', 'form');

          var added = ErrorLookup.add(frm.scope, 'NAME', frm.controller, {}, false, 'My Form');

          added.label('dummy','Some field');

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
    });

  });

  describe('directives', function (){

  });
});
