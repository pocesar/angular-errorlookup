describe('ErrorLookup', function () {
    "use strict";

    var expect = chai.expect;
    var $provide;
    var $compile;
    var $injector;
    var $rootScope;
    var $q;
    var Provider;
    var createModel;
    var $interpolate;
    var ErrorLookup;
    var $templateCache;

    var $exceptionHandler = {
        fn: function(exception, cause) {
            throw exception;
        }
    };

    beforeEach(module('ngErrorLookup', function (ErrorLookupProvider, _$provide_) {
        Provider = ErrorLookupProvider;
        $provide = _$provide_;

        $provide.factory('$exceptionHandler', function() {
            return function(exception, cause) {
                return $exceptionHandler.fn(exception, cause);
            };
        });
    }));


    beforeEach(inject(function(_$compile_, _$q_, _$injector_, _$rootScope_, _$interpolate_, _$templateCache_) {
        $compile = _$compile_;
        $q = _$q_;
        $injector = _$injector_;
        $rootScope = _$rootScope_;
        ErrorLookup = $injector.get('ErrorLookup');
        $interpolate = _$interpolate_;
        $templateCache = _$templateCache_;

        createModel = function (name, $scope, el, controller) {
            if (!$scope) {
                $scope = $rootScope.$new();
            }

            var
                element = angular.element(el || '<input ng-model="' + name + '">'),
                compileFn = $compile(element),
                compiled = compileFn($scope);

            return {
                name: name,
                element: element,
                scope: $scope,
                controller: compiled.controller(controller || 'ngModel')
            };
        };
    }));

    afterEach(function(){
        if ($exceptionHandler.fn.restore) {
            $exceptionHandler.fn.restore();
        }
    });

    // Provider

    describe('provider', function () {

        it('exists', function () {
            expect(Provider).to.exist;
            expect(Provider.$get).to.be.an('array');
            expect(Provider.add).to.be.a('function');
            expect(Provider.remove).to.be.a('function');
        });

        it('adds messages to the queue', function () {
            expect(Provider.add('dummy', 'dummy')).to.equal(Provider);
            expect(Provider.messageQueue.dummy).to.equal('dummy');
        });

        it('removes messages from the queue', function () {

            expect(Provider.add('dummy', 'dummy').remove('dummy')).to.equal(Provider);
            expect(Provider.messageQueue.dummy).to.be.an('undefined');
        });

    });

    // Service

    describe('service', function () {

        it('exists', function () {
            expect(ErrorLookup).to.exist;
        });

        describe('messages', function () {

            it('$interpolate message strings', function () {

                expect(ErrorLookup.messages.add('dummy', 'dummy!')).to.be.a('function');
                expect(ErrorLookup.messages.types.dummy()).to.equal('dummy!');
            });

            it('callback on function', function (done) {
                var fn = function (f) {
                    expect(f).to.equal(true);
                    done();
                };

                expect(ErrorLookup.messages.add('dummy', fn)).to.be.a('function');

                ErrorLookup.messages.types.dummy(true);
            });

            it('ignores invalid parameters', function () {
                ErrorLookup.messages.add('dummy', false);
                expect(ErrorLookup.messages.types.dummy).to.be.an('undefined');

                ErrorLookup.messages.add('dummy', { required: true });
                expect(ErrorLookup.messages.types.dummy).to.be.an('undefined');

                ErrorLookup.messages.add('dummy', 0);
                expect(ErrorLookup.messages.types.dummy).to.be.an('undefined');
            });

            describe('include', function () {
                var $httpBackend;

                beforeEach(function () {
                    $httpBackend = $injector.get('$httpBackend');
                    $httpBackend.when('GET', '/messages.json').respond(200, { required: 'fill {{ $label }}', email: 'not an email' });
                });

                it('loads and manipulates messages', function (done) {

                    ErrorLookup.messages.include('/messages.json').then(function (messages) {
                        delete messages['min'];

                        expect(ErrorLookup.messages.types.min).to.be.an('undefined');
                        expect(ErrorLookup.messages.types.required({ $label: 'lol' })).to.equal('fill lol');
                        expect(ErrorLookup.messages.types.email()).to.equal('not an email');

                    }).then(done);

                    $httpBackend.flush();
                });

                afterEach(function () {
                    $httpBackend.verifyNoOutstandingExpectation();
                    $httpBackend.verifyNoOutstandingRequest();
                });
            });


        });

        describe('errors', function () {

            it('adds an ngModel and ngForm to the bunch', function () {
                    var
                        input = createModel('dummy'),
                        form = createModel('frm', input.scope, '<form></form>', 'form');

                    var added = ErrorLookup.add({
                        scope: input.scope,
                        name: input.name,
                        controller: input.controller,
                        attrs: {}
                    });

                    expect(added.helpers.error).to.be.a('function');
                    expect(added.helpers.remove).to.be.a('function');
                    expect(added.controller).to.equal(input.controller);
                    expect(ErrorLookup.get(input.scope.$id, input.name)).to.equal(added);
                    expect(added.controller.$setViewValue).to.be.a('function');

                    added = ErrorLookup.add({
                        scope: form.scope,
                        name: form.name,
                        controller: form.controller,
                        attrs: {},
                        isForm: true
                    });

                    expect(added.helpers.error).to.be.a('function');
                    expect(added.helpers.remove).to.be.a('function');
                    expect(added.controller).to.equal(form.controller);
                    expect(ErrorLookup.get(form.scope.$id, form.name)).to.equal(added);
                    expect(added.controller.$addControl).to.be.a('function');
            });

            it('reflects errors on the array on input', function () {
                    ErrorLookup.messages.add('required', 'fill it');

                    var
                        input = createModel('dummy', false, '<input ng-model="dummy" required>');

                    var added = ErrorLookup.add({
                        scope: input.scope,
                        name: input.name,
                        controller: input.controller,
                        attrs: {}
                    });

                    input.scope.$digest();

                    var errors = added.helpers.error();


                    expect(errors).to.eql([
                        {
                            id: 0,
                            type: 'required',
                            item: added,
                            name: 'dummy',
                            message: 'fill it',
                            label: 'dummy'
                        }
                    ]);
            });

            it('has a bunch of helpers in the interpolated string', function () {
                ErrorLookup.messages.add('email', '{{ $value }}_{{ $name }}_{{ $models.dummy.controller.$modelValue }}_{{ $scope.$id }}_{{ $model.$modelValue }}_{{ $scope.isSet() }}');

                var
                    input = createModel('dummy', false, '<input ng-model="dummy" required type="email">');

                var added = ErrorLookup.add({
                    scope: input.scope,
                    name: input.name,
                    controller: input.controller,
                    attrs: {}
                });

                input.scope.dummy = 'adf';
                input.scope.isSet = function () { return true; };

                input.scope.$digest();

                var errors = added.helpers.error();
                expect(errors).to.have.length(1);
                expect(errors[0].message).to.match(/adf_dummy_adf_[^\_]+_adf_true/);
            });

            it('executes the callback instead of interpolated string', function() {
                ErrorLookup.messages.add('required', function (model) {
                    return $interpolate('WOW {{ loled }}')(model.$scope);
                });

                var
                    input = createModel('dummy', false, '<input ng-model="dummy" required>');

                var added = ErrorLookup.add({
                    scope: input.scope,
                    name: input.name,
                    controller: input.controller,
                    attrs: {}
                });

                input.scope.loled = 'I loled!';
                input.scope.$digest();

                var errors = ErrorLookup.get(input.scope.$id, input.name, true);

                expect(errors.error()).to.eql([
                    {
                        id: 0,
                        type: 'required',
                        message: 'WOW I loled!',
                        item: added,
                        name: 'dummy',
                        label: 'dummy'
                    }
                ]);

            });

            it('empty array on no errors', function () {
                var
                    input = createModel('dummy', false, '<input ng-model="dummy" required>');

                var added = ErrorLookup.add({
                    scope: input.scope,
                    name: input.name,
                    controller: input.controller,
                    attrs: {}
                });

                input.scope.dummy = 'its empty';
                input.scope.$digest();

                expect(added.helpers.error()).to.eql([]);
                expect(added.errors).to.eql([]);
                expect(added.errors).to.equal(added.helpers.error());
            });

            describe('form', function () {
                it('empty array on no errors', function () {
                    var
                        frm = createModel('frm', false, '<form><input ng-model="dummy"></form>', 'form');

                    var added = ErrorLookup.add({
                        scope: frm.scope,
                        name: frm.name,
                        controller: frm.controller,
                        isForm: true,
                        attrs: {}
                    });

                    frm.scope.$digest();

                    expect(added.helpers.error()).to.eql([]);
                    expect(added.errors).to.eql([]);
                    expect(added.errors).to.equal(added.helpers.error());
                });

                /*it('display errors from sub models', function () {
                    var
                        frm = createModel('frm', false, '<form><input ng-model="dummy" required></form>', 'form');

                    var added = ErrorLookup.add({
                        scope: frm.scope,
                        name: frm.name,
                        controller: frm.controller,
                        isForm: true,
                        attrs: {}
                    });

                    frm.scope.$digest();

                    var eql = [
                        {
                            id: 0,
                            type: 'required',
                            message: 'You must fill this field',
                            item: added,
                            name: 'frm',
                            label: 'frm'
                        }
                    ];

                    var errs = added.helpers.error();

                    expect(errs).to.eql(eql);
                    expect(added.errors).to.eql(eql);
                    expect(added.errors).to.equal(errs);

                    frm.scope.dummy = 'asdf';
                    frm.scope.$digest();

                    expect(added.helpers.error()).to.eql([]);
                });

                it('display errors from sub models with labels', function () {
                    var
                        frm = createModel('frm', false, '<form><input ng-model="dummy" name="dummy" required></form>', 'form');

                    var added = ErrorLookup.add({
                        scope: frm.scope,
                        name: 'NAME',
                        controller: frm.controller,
                        attrs: {},
                        isForm: true,
                        label: 'My Form'
                    });

                    added.helpers.label('dummy', 'Some field');

                    frm.scope.$digest();

                    console.log(added.helpers.error());

                    expect(added.helpers.error()).to.eql([
                        {
                            id: 0,
                            type: 'required',
                            item: added,
                            message: 'You must fill Some field',
                            name: 'My Form',
                            label: 'Some field'
                        }
                    ]);
                });*/
            });

            it('force errors to the model, without touching its value and without changing its state', function () {
                var
                    input = createModel('dummy', false, '<input ng-model="dummy">');

                var added = ErrorLookup.add({
                    scope: input.scope,
                    name: 'OMG',
                    controller: input.controller,
                    attrs: { 'ngModel': 'dummy' }
                });

                input.scope.dummy = 'hooray!';
                input.scope.$digest();

                expect(added.helpers.error({ 'notyet': true })).to.eql([]);

                ErrorLookup.messages.add('model', 'The model is {{ $attrs.ngModel }} with value {{ $value }}');

                expect(added.helpers.error({ 'model': true })).to.eql([
                    {
                        id: 0,
                        type: 'model',
                        message: 'The model is dummy with value hooray!',
                        item: added,
                        label: 'OMG',
                        name: 'OMG'
                    }
                ]);
            });

            it('has scope and group name', function () {
                var
                    input = createModel('dummy'),
                    input2 = createModel('clumsy', input.scope)
                    ;

                var added = [
                    ErrorLookup.add({
                        scope: input.scope,
                        name: input.name,
                        controller: input.controller,
                        attrs: {},
                        group: 'somegroup',
                        label: 'main'
                    }),
                    ErrorLookup.add({
                        scope: input2.scope,
                        name: input2.name,
                        controller: input2.controller,
                        attrs: {},
                        group: 'somegroup',
                        label: 'another'
                    })
                ];

                var obj = ErrorLookup.errors('somegroup');
                expect(obj.dummy).to.be.a('function');
                expect(obj.clumsy).to.be.a('function');
                expect(obj.dummy()).to.equal(added[0].helpers.error());
                expect(obj.clumsy()).to.equal(added[1].helpers.error());

                obj = ErrorLookup.errors('somegroup', ['dummy']);
                expect(obj.clumsy).to.be.an('undefined');

                obj = ErrorLookup.errors('somegroup', false, true);

                expect(obj.dummy).to.be.an('array');
                expect(obj.clumsy).to.be.an('array');
            });

            it('keep reference', function () {
                var
                    input = createModel('name');

                ErrorLookup.add({
                    scope: input.scope,
                    name: input.name,
                    controller: input.controller,
                    attrs: {},
                    group: 'group'
                });

                var errors = ErrorLookup.get('group', 'name').errors;

                expect(errors).to.be.an('array');
                expect(errors).to.have.length(0);

                ErrorLookup.error('group', 'name')({ required: true });

                expect(errors).to.have.length(1);
                expect(ErrorLookup.error('group', 'name')({ required: true }, true)).to.equal(errors);
                expect(ErrorLookup.errors('group', ['name'], true)).to.eql({
                    name: errors
                });
            });

            it('returns empty object on invalid group', function () {
                expect(function(){
                    ErrorLookup.errors('invalid')
                }).to.throw('ErrorLookupError');
            });

            it('returns empty object on invalid picks', function () {
                var
                    input = createModel('name');

                ErrorLookup.add({
                    scope: input.scope,
                    name: input.name,
                    controller: input.controller,
                    attrs: {}
                });

                expect(function(){
                    ErrorLookup.errors(input.scope.$id, ['nope', 'nope', 'nope']);
                }).to.throw('ErrorLookupError');
            });
        });

    });

    describe('directives', function () {

    });
});
